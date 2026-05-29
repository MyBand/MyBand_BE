import request from 'supertest';
import { app } from './helpers/createApp';

// Minimal valid 1x1 PNG decoded from base64
const VALID_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==',
  'base64',
);

// Minimal SVG content with XSS payload
const SVG_CONTENT = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

describe('S1-1: SVG upload blocked (stored XSS prevention)', () => {
  it('rejects SVG upload with 400 (not 401) — blocked before auth', async () => {
    const res = await request(app)
      .post('/attachments/images')
      .attach('file', SVG_CONTENT, { filename: 'evil.svg', contentType: 'image/svg+xml' });
    expect(res.status).toBe(400);
  });

  it('rejects SVG disguised as image/octet-stream with 400', async () => {
    const res = await request(app)
      .post('/attachments/images')
      .attach('file', SVG_CONTENT, { filename: 'evil.svg', contentType: 'application/octet-stream' });
    expect(res.status).toBe(400);
  });

  it('accepts valid PNG — returns 401 (auth fails, not mime rejection)', async () => {
    const res = await request(app)
      .post('/attachments/images')
      .attach('file', VALID_PNG, { filename: 'photo.png', contentType: 'image/png' });
    // 401 means multer accepted it but JWT auth failed — confirms PNG is not blocked
    expect(res.status).toBe(401);
  });

  it('rejects SVG with application/octet-stream even with .svg extension', async () => {
    const res = await request(app)
      .post('/attachments/images')
      .attach('file', SVG_CONTENT, { filename: 'tricky.svg', contentType: 'application/octet-stream' });
    expect(res.status).toBe(400);
  });
});
