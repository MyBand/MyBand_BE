/**
 * S2-1: WebSocket auth — token must be in Sec-WebSocket-Protocol header,
 * NOT in the URL query string.
 *
 * All tests exercise auth-rejection paths (401) that don't require a real DB.
 */

// Set required env vars before any module imports that read them at load time.
process.env.JWT_SECRET = 'test-secret-that-is-32-chars-long!!';
process.env.DATABASE_URL = 'file:./prisma/test.db';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';

// Mock the Prisma module so the test doesn't need a real SQLite file.
jest.mock('../utils/prisma', () => ({
  prisma: {
    revokedToken: {
      findUnique: jest.fn().mockResolvedValue(null), // tokens are never revoked in tests
      create: jest.fn().mockResolvedValue({}),
    },
    bandMember: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    band: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({}),
    },
  },
}));

import http from 'http';
import { WebSocket } from 'ws';
import { attachChatServer } from '../ws/chatServer';
import { makeTestToken } from './helpers/auth';

let server: http.Server;
let baseUrl: string;

beforeAll((done) => {
  server = http.createServer((_req, res) => {
    // Plain HTTP fallback — WS upgrades are handled by chatServer
    res.writeHead(200);
    res.end('ok');
  });
  attachChatServer(server);
  server.listen(0, () => {
    const addr = server.address() as { port: number };
    baseUrl = `ws://localhost:${addr.port}`;
    done();
  });
});

afterAll((done) => {
  server.close(done);
});

describe('S2-1: WebSocket auth uses Sec-WebSocket-Protocol, not query string', () => {
  it('rejects WS connection with no subprotocol (no token) — closes with 401', (done) => {
    const ws = new WebSocket(`${baseUrl}/bands/test-band-id/chat`);
    ws.on('unexpected-response', (_req, res) => {
      expect(res.statusCode).toBe(401);
      done();
    });
    ws.on('error', () => done()); // connection refused is also acceptable
  });

  it('rejects WS connection with token in query string (old behavior blocked)', (done) => {
    const { token } = makeTestToken();
    // Old URL format — should now fail because we don't read ?token= anymore
    const ws = new WebSocket(`${baseUrl}/bands/test-band-id/chat?token=${token}`);
    ws.on('unexpected-response', (_req, res) => {
      // 401 because the protocol header is missing (no token in right place)
      expect(res.statusCode).toBe(401);
      done();
    });
    ws.on('error', () => done());
  });

  it('rejects WS connection with only "bearer" in protocol but no token value', (done) => {
    const ws = new WebSocket(`${baseUrl}/bands/test-band-id/chat`, ['bearer']);
    ws.on('unexpected-response', (_req, res) => {
      expect(res.statusCode).toBe(401);
      done();
    });
    ws.on('error', () => done());
  });

  it('rejects WS connection with invalid/expired token in protocol header', (done) => {
    const ws = new WebSocket(`${baseUrl}/bands/test-band-id/chat`, ['bearer', 'not-a-valid-jwt']);
    ws.on('unexpected-response', (_req, res) => {
      expect(res.statusCode).toBe(401);
      done();
    });
    ws.on('error', () => done());
  });
});
