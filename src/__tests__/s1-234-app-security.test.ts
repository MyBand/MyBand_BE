import request from 'supertest';
import { app } from './helpers/createApp';

// Minimal 1x1 PNG (68 bytes) — valid PNG magic bytes
const VALID_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

describe('S1-2: Security headers (helmet)', () => {
  it('GET /health includes X-Content-Type-Options header', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('GET /health includes X-Frame-Options header', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  it('GET /health includes Content-Security-Policy header', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['content-security-policy']).toBeDefined();
  });
});

describe('S1-3: Upload auth runs before multer', () => {
  it('POST /attachments/images without JWT returns 401 before parsing body', async () => {
    const res = await request(app)
      .post('/api/attachments/images')
      .attach('file', VALID_PNG, { filename: 'photo.png', contentType: 'image/png' });
    expect(res.status).toBe(401);
  });

  it('POST /attachments/files without JWT returns 401', async () => {
    const res = await request(app)
      .post('/api/attachments/files')
      .attach('file', Buffer.from('%PDF-1.4'), { filename: 'doc.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(401);
  });
});

describe('S1-4: CORS disallowed origin returns non-500', () => {
  it('request from unknown origin does not return 500', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'https://evil-attacker.com');
    // Should be 200 (CORS simply won't include allow headers — browser enforces it)
    // The key is it must NOT be 500
    expect(res.status).not.toBe(500);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('request from allowed origin includes CORS headers', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:5000');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5000');
  });
});
