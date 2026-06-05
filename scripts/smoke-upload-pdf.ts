import 'dotenv/config';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../src/utils/prisma';

const BASE = 'http://localhost:3000';
const SECRET = process.env.JWT_SECRET!;

async function call(
  method: string,
  path: string,
  token: string,
  body?: FormData,
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  const t = await res.text();
  try { return { status: res.status, body: JSON.parse(t) }; }
  catch { return { status: res.status, body: t }; }
}

let pass = 0; let fail = 0;
function expect(name: string, ok: boolean, detail?: unknown) {
  if (ok) { pass++; console.log(`PASS  ${name}`); }
  else     { fail++; console.log(`FAIL  ${name}`, detail ?? ''); }
}

async function main() {
  const sub = `smoke-${crypto.randomBytes(4).toString('hex')}`;
  const u = await prisma.user.create({
    data: { googleSub: sub, email: `${sub}@e.com`, name: 'T' },
  });
  const token = jwt.sign({ sub: u.id }, SECRET, {
    expiresIn: '1h', jwtid: crypto.randomUUID(),
  });

  // 1. PNG — 기존 동작 유지
  const f1 = new FormData();
  f1.append('file', new Blob([new Uint8Array([0x89,0x50,0x4e,0x47])], { type: 'image/png' }), 'test.png');
  const r1 = await call('POST', '/api/attachments/images', token, f1);
  expect('PNG 업로드 201', r1.status === 201);
  expect('PNG URL .png', (r1.body as {url:string}).url?.endsWith('.png'));

  // 2. PDF — 신규 허용
  const f2 = new FormData();
  f2.append('file', new Blob([Buffer.from('%PDF-1.4')], { type: 'application/pdf' }), 'score.pdf');
  const r2 = await call('POST', '/api/attachments/images', token, f2);
  expect('PDF 업로드 201', r2.status === 201, r2);
  expect('PDF URL .pdf', (r2.body as {url:string}).url?.endsWith('.pdf'), r2.body);

  // 3. 서버에서 반환된 PDF URL 접근 가능
  const pdfUrl = (r2.body as {url:string}).url;
  const fetch2 = await fetch(pdfUrl);
  expect('저장된 PDF 접근 200', fetch2.status === 200);

  // 4. 허용 안 되는 타입 → 400
  const f3 = new FormData();
  f3.append('file', new Blob([Buffer.from('data')], { type: 'audio/mpeg' }), 'x.mp3');
  const r3 = await call('POST', '/api/attachments/images', token, f3);
  expect('허용 안 되는 타입 400', r3.status === 400, r3.body);

  // 5. 20MB 초과 → 413
  const big = Buffer.alloc(20 * 1024 * 1024 + 100, 0x25);
  const f4 = new FormData();
  f4.append('file', new Blob([new Uint8Array(big)], { type: 'application/pdf' }), 'big.pdf');
  const r4 = await call('POST', '/api/attachments/images', token, f4);
  expect('20MB 초과 413', r4.status === 413, r4.body);

  console.log(`\n${pass} passed, ${fail} failed`);
  await prisma.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
