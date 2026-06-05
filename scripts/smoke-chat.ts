import 'dotenv/config';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { WebSocket } from 'ws';
import { prisma } from '../src/utils/prisma';

const PORT = process.env.PORT ?? 3000;
const BASE = `http://localhost:${PORT}`;
const WS_BASE = `ws://localhost:${PORT}`;
const SECRET = process.env.JWT_SECRET!;

interface TestUser {
  id: string;
  email: string;
  token: string;
}

async function makeUser(name: string): Promise<TestUser> {
  const sub = `smoke-${crypto.randomBytes(4).toString('hex')}`;
  const u = await prisma.user.create({
    data: { googleSub: sub, email: `${sub}@example.com`, name },
  });
  const token = jwt.sign({ sub: u.id }, SECRET, {
    expiresIn: '1h',
    jwtid: crypto.randomUUID(),
  });
  return { id: u.id, email: u.email, token };
}

async function call(
  method: string,
  path: string,
  user: TestUser | null,
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(user ? { Authorization: `Bearer ${user.token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    /* leave */
  }
  return { status: res.status, body: parsed };
}

let pass = 0;
let fail = 0;
function expect(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    pass++;
    console.log(`PASS  ${name}`);
  } else {
    fail++;
    console.log(`FAIL  ${name}`, detail ?? '');
  }
}

interface OpenWsResult {
  ws: WebSocket;
  status: 'open' | 'rejected';
  rejectionStatus?: number;
  received: { type: string; data: { id: string; text: string } }[];
}

function openWs(bandId: string, token: string | null): Promise<OpenWsResult> {
  return new Promise((resolve) => {
    const url = token
      ? `${WS_BASE}/bands/${bandId}/chat?token=${encodeURIComponent(token)}`
      : `${WS_BASE}/bands/${bandId}/chat`;
    const ws = new WebSocket(url);
    const result: OpenWsResult = { ws, status: 'rejected', received: [] };
    const timeout = setTimeout(() => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      resolve(result);
    }, 1500);

    ws.on('open', () => {
      clearTimeout(timeout);
      result.status = 'open';
      resolve(result);
    });
    ws.on('unexpected-response', (_req, res) => {
      clearTimeout(timeout);
      result.rejectionStatus = res.statusCode;
      resolve(result);
    });
    ws.on('error', () => {
      /* ignored — unexpected-response covers our case */
    });
    ws.on('message', (raw) => {
      try {
        const parsed = JSON.parse(raw.toString());
        result.received.push(parsed);
      } catch {
        /* ignore non-JSON */
      }
    });
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const alice = await makeUser('Alice');
  const bob = await makeUser('Bob');
  const carol = await makeUser('Carol');

  // Setup band: Alice owner, Bob member; Carol is non-member.
  const bandRes = await call('POST', '/api/bands', alice, {
    name: 'ChatBand',
  });
  const bandId = (bandRes.body as { id: string }).id;
  await call('POST', `/api/bands/${bandId}/members`, alice, { email: bob.email });

  // -- HTTP message basics --
  const send1 = await call('POST', `/api/bands/${bandId}/messages`, alice, {
    text: 'hello world',
  });
  expect('http send 201', send1.status === 201, send1);

  const carolSend = await call('POST', `/api/bands/${bandId}/messages`, carol, {
    text: 'sneaky',
  });
  expect('non-member send 403', carolSend.status === 403, carolSend);

  const list1 = await call('GET', `/api/bands/${bandId}/messages`, alice);
  expect(
    'list returns the sent message',
    list1.status === 200 &&
      Array.isArray((list1.body as { messages: unknown[] }).messages) &&
      (list1.body as { messages: { id: string }[] }).messages.length === 1,
    list1,
  );
  expect(
    'nextCursor null when single page',
    (list1.body as { nextCursor: string | null }).nextCursor === null,
    list1,
  );

  // -- Cursor pagination --
  // Send 5 more (so 6 total). Spaced slightly to avoid ms ties.
  for (let i = 0; i < 5; i++) {
    await call('POST', `/api/bands/${bandId}/messages`, alice, {
      text: `msg-${i}`,
    });
    await sleep(20);
  }
  const page1 = await call(
    'GET',
    `/api/bands/${bandId}/messages?limit=3`,
    alice,
  );
  const p1 = page1.body as {
    messages: { id: string; text: string }[];
    nextCursor: string | null;
  };
  expect(
    'page1 length=3',
    page1.status === 200 && p1.messages.length === 3,
    p1,
  );
  expect('page1 newest-first', p1.messages[0].text === 'msg-4', p1.messages);
  expect('page1 nextCursor present', !!p1.nextCursor, p1);

  const page2 = await call(
    'GET',
    `/api/bands/${bandId}/messages?limit=3&cursor=${p1.nextCursor}`,
    alice,
  );
  const p2 = page2.body as {
    messages: { id: string; text: string }[];
    nextCursor: string | null;
  };
  expect('page2 length=3', p2.messages.length === 3, p2);
  expect(
    'page2 has older msgs (msg-1, msg-0, hello)',
    p2.messages.map((m) => m.text).join(',') === 'msg-1,msg-0,hello world',
    p2.messages,
  );
  expect('page2 nextCursor null (end)', p2.nextCursor === null, p2);

  // -- WebSocket broadcasts --
  const aliceWs = await openWs(bandId, alice.token);
  expect('alice ws open', aliceWs.status === 'open', aliceWs);
  const bobWs = await openWs(bandId, bob.token);
  expect('bob ws open', bobWs.status === 'open', bobWs);
  const carolWs = await openWs(bandId, carol.token);
  expect(
    'non-member ws rejected (403)',
    carolWs.status === 'rejected' && carolWs.rejectionStatus === 403,
    carolWs,
  );
  const noAuthWs = await openWs(bandId, null);
  expect(
    'no-token ws rejected (401)',
    noAuthWs.status === 'rejected' && noAuthWs.rejectionStatus === 401,
    noAuthWs,
  );

  // Bob sends via HTTP — both alice and bob WS should receive
  await call('POST', `/api/bands/${bandId}/messages`, bob, {
    text: 'live broadcast 1',
  });
  await sleep(150);

  expect(
    'alice WS received broadcast',
    aliceWs.received.some((m) => m.data.text === 'live broadcast 1'),
    aliceWs.received,
  );
  expect(
    'bob WS received broadcast (echo to all)',
    bobWs.received.some((m) => m.data.text === 'live broadcast 1'),
    bobWs.received,
  );

  // Alice sends — both should receive
  await call('POST', `/api/bands/${bandId}/messages`, alice, {
    text: 'live broadcast 2',
  });
  await sleep(150);

  expect(
    'second broadcast reaches alice',
    aliceWs.received.some((m) => m.data.text === 'live broadcast 2'),
    aliceWs.received,
  );
  expect(
    'second broadcast reaches bob',
    bobWs.received.some((m) => m.data.text === 'live broadcast 2'),
    bobWs.received,
  );

  // WS event shape sanity
  const sample = aliceWs.received[0];
  expect(
    'WS event shape { type:"message", data:{...} }',
    sample.type === 'message' && typeof sample.data.id === 'string',
    sample,
  );

  // Cleanup sockets
  aliceWs.ws.close();
  bobWs.ws.close();

  console.log(`\n${pass} passed, ${fail} failed`);
  await prisma.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
