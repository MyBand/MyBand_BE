import request from 'supertest';
import { app } from './helpers/createApp';

// ─── S3-1: URL validation ─────────────────────────────────────────────────────

describe('S3-1: requireOwnUrl validates attachment URLs against BASE_URL', () => {
  it('returns null for null/undefined input (no-op)', () => {
    const { requireOwnUrl } = require('../utils/urlValidator');
    expect(requireOwnUrl(null, 'field')).toBeNull();
    expect(requireOwnUrl(undefined, 'field')).toBeNull();
    expect(requireOwnUrl('', 'field')).toBeNull();
  });

  it('skips validation when BASE_URL is not configured', () => {
    const { requireOwnUrl } = require('../utils/urlValidator');
    const original = process.env.BASE_URL;
    delete process.env.BASE_URL;
    try {
      expect(() => requireOwnUrl('https://evil.com/track.png', 'field')).not.toThrow();
    } finally {
      if (original !== undefined) process.env.BASE_URL = original;
    }
  });

  it('throws 400 when BASE_URL is set and URL does not start with BASE_URL/attachments/', () => {
    const { requireOwnUrl } = require('../utils/urlValidator');
    process.env.BASE_URL = 'https://myserver.example.com';
    try {
      expect(() =>
        requireOwnUrl('https://evil.com/track.png', 'profileImageUrl'),
      ).toThrow('profileImageUrl');
    } finally {
      delete process.env.BASE_URL;
    }
  });

  it('accepts URL that starts with BASE_URL/attachments/', () => {
    const { requireOwnUrl } = require('../utils/urlValidator');
    process.env.BASE_URL = 'https://myserver.example.com';
    try {
      expect(() =>
        requireOwnUrl('https://myserver.example.com/attachments/cm123abc', 'profileImageUrl'),
      ).not.toThrow();
      expect(
        requireOwnUrl('https://myserver.example.com/attachments/cm123abc', 'profileImageUrl'),
      ).toBe('https://myserver.example.com/attachments/cm123abc');
    } finally {
      delete process.env.BASE_URL;
    }
  });

  it('tolerates trailing slash in BASE_URL', () => {
    const { requireOwnUrl } = require('../utils/urlValidator');
    process.env.BASE_URL = 'https://myserver.example.com/';
    try {
      expect(() =>
        requireOwnUrl('https://myserver.example.com/attachments/cm123', 'icon'),
      ).not.toThrow();
    } finally {
      delete process.env.BASE_URL;
    }
  });
});

// ─── S3-6: CORS credentials removed ─────────────────────────────────────────

describe('S3-6: CORS response does not include credentials header', () => {
  it('CORS response from allowed origin does not set Access-Control-Allow-Credentials', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:3000');
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('app.ts source no longer contains credentials: true', () => {
    const fs = require('fs');
    const path = require('path');
    const source: string = fs.readFileSync(
      path.join(__dirname, '../app.ts'),
      'utf8',
    );
    expect(source).not.toContain('credentials: true');
  });
});

// ─── S3-7: /docs restricted in production ────────────────────────────────────

describe('S3-7: /docs is not served in production', () => {
  it('/docs is accessible in test environment (NODE_ENV=test)', async () => {
    const res = await request(app).get('/docs/');
    // In test env (not 'production'), /docs should exist (200 or redirect)
    expect(res.status).not.toBe(404);
  });

  it('app.ts source guards /docs with NODE_ENV !== production check', () => {
    const fs = require('fs');
    const path = require('path');
    const source: string = fs.readFileSync(
      path.join(__dirname, '../app.ts'),
      'utf8',
    );
    expect(source).toContain("NODE_ENV !== 'production'");
    expect(source).toContain('/docs');
  });
});
