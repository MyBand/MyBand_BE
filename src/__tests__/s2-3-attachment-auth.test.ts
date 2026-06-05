/**
 * S2-3: GET /attachments/:id — gated behind JWT auth + band membership.
 * /static/uploads is no longer publicly accessible.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import request from 'supertest';
import { app } from './helpers/createApp';
import { makeTestToken } from './helpers/auth';
import { setupTestDb } from './helpers/db';
import { prisma } from '../utils/prisma';

// Minimal valid 1x1 PNG
const VALID_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==',
  'base64',
);

let uploaderUserId: string;
let nonMemberUserId: string;
let memberUserId: string;
let bandId: string;

// IDs for the attachments created in setup
let profileAttachmentId: string;      // no bandId — profile image
let bandAttachmentId: string;         // bandId set — band-scoped

beforeAll(async () => {
  await setupTestDb();

  // Create users
  const uploaderId = crypto.randomUUID();
  const nonMemberId = crypto.randomUUID();
  const memberId = crypto.randomUUID();

  await prisma.user.createMany({
    data: [
      {
        id: uploaderId,
        googleSub: `sub-${uploaderId}`,
        email: `uploader-${uploaderId}@test.com`,
        name: 'Uploader',
      },
      {
        id: nonMemberId,
        googleSub: `sub-${nonMemberId}`,
        email: `nonmember-${nonMemberId}@test.com`,
        name: 'Non Member',
      },
      {
        id: memberId,
        googleSub: `sub-${memberId}`,
        email: `member-${memberId}@test.com`,
        name: 'Band Member',
      },
    ],
  });

  uploaderUserId = uploaderId;
  nonMemberUserId = nonMemberId;
  memberUserId = memberId;

  // Create a band
  const band = await prisma.band.create({
    data: {
      name: 'Test Band',
      inviteCode: crypto.randomUUID(),
    },
  });
  bandId = band.id;

  // Add memberId as an active band member
  await prisma.bandMember.create({
    data: {
      bandId,
      userId: memberId,
      role: 'member',
    },
  });

  // Ensure uploads directories exist
  const uploadRoot = path.resolve(process.cwd(), 'uploads');
  fs.mkdirSync(path.join(uploadRoot, 'images'), { recursive: true });
  fs.mkdirSync(path.join(uploadRoot, 'files'), { recursive: true });

  // Create a profile image attachment (no bandId)
  const profileFilename = `${crypto.randomUUID()}.png`;
  fs.writeFileSync(path.join(uploadRoot, 'images', profileFilename), VALID_PNG);
  const profileAttachment = await prisma.attachment.create({
    data: {
      uploaderId,
      subdir: 'images',
      filename: profileFilename,
      mimeType: 'image/png',
      bandId: null,
    },
  });
  profileAttachmentId = profileAttachment.id;

  // Create a band-scoped attachment
  const bandFilename = `${crypto.randomUUID()}.png`;
  fs.writeFileSync(path.join(uploadRoot, 'images', bandFilename), VALID_PNG);
  const bandAttachment = await prisma.attachment.create({
    data: {
      uploaderId,
      subdir: 'images',
      filename: bandFilename,
      mimeType: 'image/png',
      bandId,
    },
  });
  bandAttachmentId = bandAttachment.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('S2-3: Attachment serve route requires JWT auth + band membership', () => {
  it('GET /attachments/:id without JWT returns 401', async () => {
    const res = await request(app).get(`/api/attachments/${profileAttachmentId}`);
    expect(res.status).toBe(401);
  });

  it('GET /attachments/:id for a profile image (no bandId) with valid JWT returns 200', async () => {
    const { token } = makeTestToken(uploaderUserId);
    const res = await request(app)
      .get(`/api/attachments/${profileAttachmentId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('GET /attachments/:id for a band attachment — non-member gets 403', async () => {
    const { token } = makeTestToken(nonMemberUserId);
    const res = await request(app)
      .get(`/api/attachments/${bandAttachmentId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('GET /attachments/:id for a band attachment — band member gets 200', async () => {
    const { token } = makeTestToken(memberUserId);
    const res = await request(app)
      .get(`/api/attachments/${bandAttachmentId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('GET /attachments/:nonexistent-id returns 404', async () => {
    const { token } = makeTestToken(uploaderUserId);
    const res = await request(app)
      .get('/api/attachments/nonexistent-cuid-12345')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('GET /static/uploads/... is no longer accessible (returns 404)', async () => {
    const res = await request(app).get('/static/uploads/images/somefile.png');
    expect(res.status).toBe(404);
  });
});
