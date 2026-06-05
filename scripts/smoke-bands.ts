import 'dotenv/config';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../src/utils/prisma';

const BASE = `http://localhost:${process.env.PORT ?? 3000}`;
const SECRET = process.env.JWT_SECRET!;

interface TestUser {
  id: string;
  email: string;
  name: string;
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
  return { id: u.id, email: u.email, name, token };
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
    /* leave as text */
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
  const bob = await makeUser('Bob');
  const carol = await makeUser('Carol');

  // 1. Create band as Alice
  const create = await call('POST', '/api/bands', alice, {
    name: 'IndieStars',
    description: 'modern rock',
  });
  expect('create band 201', create.status === 201, create);
  const bandId = (create.body as { id: string }).id;
  expect(
    'created band has memberCount=1',
    (create.body as { memberCount: number }).memberCount === 1,
    create.body,
  );

  // 2. List as Alice — should include band
  const listA = await call('GET', '/api/bands', alice);
  expect(
    'list bands as owner',
    listA.status === 200 &&
      Array.isArray(listA.body) &&
      (listA.body as { id: string }[]).some((b) => b.id === bandId),
    listA,
  );

  // 3. Bob (non-member) gets 403 on detail
  const detailBob = await call('GET', `/api/bands/${bandId}`, bob);
  expect('non-member 403 on band detail', detailBob.status === 403, detailBob);

  // 4. Invite Bob by email
  const inv = await call('POST', `/api/bands/${bandId}/members`, alice, {
    email: bob.email,
    instrument: 'Bass',
  });
  expect('invite by email 201', inv.status === 201, inv);

  // 5. Invite non-existent email → 404
  const invMissing = await call('POST', `/api/bands/${bandId}/members`, alice, {
    email: 'ghost@nowhere.test',
  });
  expect(
    'invite missing user 404',
    invMissing.status === 404,
    invMissing,
  );

  // 6. List members
  const membersList = await call('GET', `/api/bands/${bandId}/members`, alice);
  expect(
    'list members ok',
    membersList.status === 200 &&
      (membersList.body as unknown[]).length === 2,
    membersList,
  );

  // 7. Bob (member, not owner) tries to PATCH band → 403
  const patchBob = await call('PATCH', `/api/bands/${bandId}`, bob, {
    name: 'hacked',
  });
  expect('non-owner cannot patch band', patchBob.status === 403, patchBob);

  // 8. Alice (owner) PATCHes band → 200
  const patchA = await call('PATCH', `/api/bands/${bandId}`, alice, {
    description: 'updated',
  });
  expect(
    'owner patch band',
    patchA.status === 200 &&
      (patchA.body as { description: string }).description === 'updated',
    patchA,
  );

  // 9. Bob updates his own instrument → 200
  const selfUpdate = await call(
    'PATCH',
    `/api/bands/${bandId}/members/${bob.id}`,
    bob,
    { instrument: 'Drums' },
  );
  expect(
    'self instrument update ok',
    selfUpdate.status === 200 &&
      (selfUpdate.body as { instrument: string }).instrument === 'Drums',
    selfUpdate,
  );

  // 10. Bob tries to change his own role → 403
  const selfRole = await call(
    'PATCH',
    `/api/bands/${bandId}/members/${bob.id}`,
    bob,
    { role: 'owner' },
  );
  expect('self role change forbidden', selfRole.status === 403, selfRole);

  // 11. Alice tries to leave (last owner) → 409
  const aliceLeave = await call(
    'DELETE',
    `/api/bands/${bandId}/members/${alice.id}`,
    alice,
  );
  expect(
    'last owner cannot leave',
    aliceLeave.status === 409,
    aliceLeave,
  );

  // 12. Alice promotes Bob to owner → 200
  const promote = await call(
    'PATCH',
    `/api/bands/${bandId}/members/${bob.id}`,
    alice,
    { role: 'owner' },
  );
  expect(
    'promote bob to owner',
    promote.status === 200 &&
      (promote.body as { role: string }).role === 'owner',
    promote,
  );

  // 13. Alice now leaves → 204
  const aliceLeave2 = await call(
    'DELETE',
    `/api/bands/${bandId}/members/${alice.id}`,
    alice,
  );
  expect('alice can leave (not last owner)', aliceLeave2.status === 204, aliceLeave2);

  // 14. Alice list → no longer has the band
  const listA2 = await call('GET', '/api/bands', alice);
  expect(
    'alice list no longer contains band',
    !(listA2.body as { id: string }[]).some((b) => b.id === bandId),
    listA2,
  );

  // 15. Carol (not a member) tries to delete band → 403
  const carolDel = await call('DELETE', `/api/bands/${bandId}`, carol);
  expect('outsider delete 403', carolDel.status === 403, carolDel);

  // 16. Bob (sole owner) deletes the band → 204
  const bobDel = await call('DELETE', `/api/bands/${bandId}`, bob);
  expect('owner delete 204', bobDel.status === 204, bobDel);

  // 17. Subsequent GET → 403 (assertMember runs first; band gone → 404)
  const after = await call('GET', `/api/bands/${bandId}`, bob);
  expect('after delete band gone', after.status === 404, after);

  console.log(`\n${pass} passed, ${fail} failed`);
  await prisma.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
