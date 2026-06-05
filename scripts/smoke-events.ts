import 'dotenv/config';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../src/utils/prisma';

const BASE = `http://localhost:${process.env.PORT ?? 3000}`;
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

async function main() {
  const alice = await makeUser('Alice');
  const carol = await makeUser('Carol');

  // Setup: create a band owned by Alice
  const bandRes = await call('POST', '/api/bands', alice, {
    name: 'EventBand',
    description: 'for events smoke',
  });
  const bandId = (bandRes.body as { id: string }).id;
  expect('setup band', bandRes.status === 201);

  // 1. Non-member lists events → 403
  const r403 = await call('GET', `/api/bands/${bandId}/events`, carol);
  expect('non-member list 403', r403.status === 403, r403);

  // 2. Member creates event with setlist (no ids)
  const create = await call('POST', `/api/bands/${bandId}/events`, alice, {
    title: 'Rehearsal',
    date: '2026-04-25',
    type: 'practice',
    description: 'first rehearsal',
    setlist: [
      { title: 'Starlight', artist: 'AnnyungBada', key: 'C Major' },
      {
        title: 'Wave',
        artist: 'Sea',
        sheetMusicUrl: 'https://example.com/s.pdf',
        references: ['https://youtube.com/x'],
      },
    ],
  });
  expect('create event 201', create.status === 201, create);
  const ev = create.body as {
    id: string;
    setlist: { id: string; title: string; references: string[] }[];
  };
  expect(
    'created setlist length=2',
    ev.setlist.length === 2,
    ev.setlist,
  );
  expect(
    'each setlist item has a generated id',
    ev.setlist.every((s) => typeof s.id === 'string' && s.id.length > 0),
    ev.setlist,
  );
  const item0Id = ev.setlist[0].id;
  const item1Id = ev.setlist[1].id;

  // 3. List events
  const listRes = await call('GET', `/api/bands/${bandId}/events`, alice);
  expect(
    'list contains created event',
    listRes.status === 200 &&
      Array.isArray(listRes.body) &&
      (listRes.body as { id: string }[]).some((e) => e.id === ev.id),
    listRes,
  );

  // 4. Date range — outside the event date returns empty
  const outside = await call(
    'GET',
    `/api/bands/${bandId}/events?from=2027-01-01&to=2027-12-31`,
    alice,
  );
  expect(
    'range outside returns empty',
    outside.status === 200 && (outside.body as unknown[]).length === 0,
    outside,
  );

  // 5. Date range — covering the event date returns it
  const inside = await call(
    'GET',
    `/api/bands/${bandId}/events?from=2026-04-01&to=2026-04-30`,
    alice,
  );
  expect(
    'range covering returns event',
    inside.status === 200 &&
      (inside.body as { id: string }[]).some((e) => e.id === ev.id),
    inside,
  );

  // 6. Get single event
  const detail = await call('GET', `/api/bands/${bandId}/events/${ev.id}`, alice);
  expect('get single event', detail.status === 200, detail);

  // 7. PATCH setlist: keep item0 by id, drop item1, add a new song
  const patch = await call(
    'PATCH',
    `/api/bands/${bandId}/events/${ev.id}`,
    alice,
    {
      setlist: [
        { id: item0Id, title: 'Starlight', artist: 'AnnyungBada' },
        { title: 'BrandNew', artist: 'NewBand' },
      ],
    },
  );
  const patched = patch.body as {
    setlist: { id: string; title: string }[];
  };
  expect('patch event 200', patch.status === 200, patch);
  expect(
    'preserved setlist id stays',
    patched.setlist[0].id === item0Id,
    patched.setlist,
  );
  expect(
    'new setlist item gets a fresh id (not the old item1 id)',
    patched.setlist[1].id !== item1Id &&
      typeof patched.setlist[1].id === 'string' &&
      patched.setlist[1].id.length > 0,
    patched.setlist,
  );

  // 8. Invalid type → 422 from Tsoa validator
  const badType = await call('POST', `/api/bands/${bandId}/events`, alice, {
    title: 'Bad',
    date: '2026-05-01',
    type: 'gig',
  });
  expect('invalid event type rejected', badType.status === 422, badType);

  // 9. Non-member tries to create → 403
  const carolCreate = await call('POST', `/api/bands/${bandId}/events`, carol, {
    title: 'Sneaky',
    date: '2026-05-01',
    type: 'practice',
  });
  expect('non-member create 403', carolCreate.status === 403, carolCreate);

  // 10. Delete event
  const del = await call('DELETE', `/api/bands/${bandId}/events/${ev.id}`, alice);
  expect('delete event 204', del.status === 204, del);

  // 11. Get deleted event → 404
  const after = await call('GET', `/api/bands/${bandId}/events/${ev.id}`, alice);
  expect('deleted event 404', after.status === 404, after);

  console.log(`\n${pass} passed, ${fail} failed`);
  await prisma.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
