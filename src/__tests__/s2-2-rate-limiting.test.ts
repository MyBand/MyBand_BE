import request from 'supertest';
import { app } from './helpers/createApp';

describe('S2-2: Rate limiting', () => {
  it('/health is not rate-limited (control test)', async () => {
    // Rapid requests to /health should all succeed
    const results = await Promise.all(
      Array.from({ length: 5 }, () => request(app).get('/health').set('X-Forwarded-For', '10.0.0.1'))
    );
    for (const res of results) {
      expect(res.status).toBe(200);
    }
  });

  it('auth endpoint returns 429 after exceeding limit', async () => {
    // Use a unique IP to avoid interfering with other tests
    const ip = '10.100.0.1';
    // Make 11 requests (limit is 10/15min)
    const responses: number[] = [];
    for (let i = 0; i < 11; i++) {
      const res = await request(app)
        .post('/api/auth/google')
        .set('X-Forwarded-For', ip)
        .send({ idToken: 'fake' });
      responses.push(res.status);
    }
    // At least one of the last few should be 429
    expect(responses).toContain(429);
  }, 30000);

  it('join endpoint returns 429 after exceeding limit', async () => {
    const ip = '10.100.0.2';
    const responses: number[] = [];
    for (let i = 0; i < 21; i++) {
      const res = await request(app)
        .post('/api/bands/join')
        .set('X-Forwarded-For', ip)
        .set('Authorization', 'Bearer fake')
        .send({ inviteCode: 'TESTCODE' });
      responses.push(res.status);
    }
    expect(responses).toContain(429);
  });

  it('upload endpoint returns 429 after exceeding limit', async () => {
    const ip = '10.100.0.3';
    const responses: number[] = [];
    for (let i = 0; i < 31; i++) {
      const res = await request(app)
        .post('/api/attachments/images')
        .set('X-Forwarded-For', ip);
      responses.push(res.status);
    }
    expect(responses).toContain(429);
  });

  it('rate-limited response includes RateLimit headers', async () => {
    const ip = '10.100.0.4';
    // Exhaust the auth limit
    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/api/auth/google')
        .set('X-Forwarded-For', ip)
        .send({ idToken: 'fake' });
    }
    // 11th request
    const res = await request(app)
      .post('/api/auth/google')
      .set('X-Forwarded-For', ip)
      .send({ idToken: 'fake' });
    expect(res.status).toBe(429);
    // standardHeaders: true means RateLimit-* headers are present
    expect(res.headers['ratelimit-limit'] ?? res.headers['x-ratelimit-limit']).toBeDefined();
  }, 30000);
});
