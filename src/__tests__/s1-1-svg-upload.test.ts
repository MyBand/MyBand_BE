import request from 'supertest';
import { app } from './helpers/createApp';
import { makeTestToken } from './helpers/auth';
import { setupTestDb } from './helpers/db';

beforeAll(async () => { await setupTestDb(); });

// Minimal valid 1x1 PNG decoded from base64
const VALID_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==',
  'base64',
);

// Minimal SVG content with XSS payload
const SVG_CONTENT = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

describe('S1-1: SVG upload blocked (stored XSS prevention)', () => {
  // S1-3 (auth before multer) means auth runs first. SVG tests supply a valid
  // JWT so auth passes and the MIME check can run, confirming the 400 comes from
  // MIME rejection, not from missing auth.
  it('rejects SVG upload with 400 even when authenticated', async () => {
    const { token } = makeTestToken();
    const res = await request(app)
      .post('/attachments/images')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', SVG_CONTENT, { filename: 'evil.svg', contentType: 'image/svg+xml' });
    expect(res.status).toBe(400);
  });

  it('rejects SVG disguised as image/octet-stream with 400 when authenticated', async () => {
    const { token } = makeTestToken();
    const res = await request(app)
      .post('/attachments/images')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', SVG_CONTENT, { filename: 'evil.svg', contentType: 'application/octet-stream' });
    expect(res.status).toBe(400);
  });

  it('rejects SVG upload without auth with 401 (auth gate active)', async () => {
    const res = await request(app)
      .post('/attachments/images')
      .attach('file', SVG_CONTENT, { filename: 'evil.svg', contentType: 'image/svg+xml' });
    // 401 because S1-3 makes auth run before multer; if somehow bypassed, SVG is still blocked at MIME layer
    expect(res.status).toBe(401);
  });

  it('rejects SVG with .svg extension and octet-stream even when authenticated', async () => {
    const { token } = makeTestToken();
    const res = await request(app)
      .post('/attachments/images')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', SVG_CONTENT, { filename: 'tricky.svg', contentType: 'application/octet-stream' });
    expect(res.status).toBe(400);
  });

  it('valid PNG without auth returns 401 — not 400 (auth runs before MIME check)', async () => {
    const res = await request(app)
      .post('/attachments/images')
      .attach('file', VALID_PNG, { filename: 'photo.png', contentType: 'image/png' });
    expect(res.status).toBe(401);
  });
});
