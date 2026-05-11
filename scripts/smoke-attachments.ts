import 'dotenv/config';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../src/utils/prisma';

const PORT = process.env.PORT ?? 3000;
const BASE = `http://localhost:${PORT}`;
const SECRET = process.env.JWT_SECRET!;

interface TestUser {
  token: string;
}

async function makeUser(): Promise<TestUser> {
  const sub = `smoke-${crypto.randomBytes(4).toString('hex')}`;
  const u = await prisma.user.create({
    data: { googleSub: sub, email: `${sub}@example.com`, name: 'Uploader' },
  });
  const token = jwt.sign({ sub: u.id }, SECRET, {
    expiresIn: '1h',
    jwtid: crypto.randomUUID(),
  });
  return { token };
}

async function uploadMultipart(
  path: string,
  token: string | null,
  fileContent: Buffer | null,
  filename: string,
  mime: string,
): Promise<{ status: number; body: unknown }> {
  const form = new FormData();
  if (fileContent !== null) {
    form.append(
      'file',
      new Blob([new Uint8Array(fileContent)], { type: mime }),
      filename,
    );
  }
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
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
  const alice = await makeUser();

  // 1. Image upload OK (PNG bytes — multer trusts Content-Type from form)
  const pngBytes = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  ]);
  const imgOk = await uploadMultipart(
    '/attachments/images',
    alice.token,
    pngBytes,
    'pic.png',
    'image/png',
  );
  expect('image upload 201', imgOk.status === 201, imgOk);
  const imgUrl = (imgOk.body as { url: string }).url;
  expect(
    'image url under /static/uploads/images/',
    typeof imgUrl === 'string' &&
      imgUrl.includes('/static/uploads/images/') &&
      imgUrl.endsWith('.png'),
    imgUrl,
  );

  // 2. Fetch the returned URL works
  const fetchBack = await fetch(imgUrl);
  const buf = Buffer.from(await fetchBack.arrayBuffer());
  expect(
    'served file matches uploaded bytes',
    fetchBack.status === 200 && buf.equals(pngBytes),
    { status: fetchBack.status, len: buf.length, expected: pngBytes.length },
  );

  // 3. Wrong mime to /images → 400
  const wrongImg = await uploadMultipart(
    '/attachments/images',
    alice.token,
    Buffer.from('%PDF-1.4'),
    'doc.pdf',
    'application/pdf',
  );
  expect('non-image to /images 400', wrongImg.status === 400, wrongImg);

  // 4. No file → 400 (BadRequestError from service)
  const noFile = await uploadMultipart(
    '/attachments/images',
    alice.token,
    null,
    '',
    '',
  );
  expect('missing file 400', noFile.status === 400, noFile);

  // 5. PDF upload OK
  const pdfBytes = Buffer.from('%PDF-1.4 minimal');
  const pdfOk = await uploadMultipart(
    '/attachments/files',
    alice.token,
    pdfBytes,
    'doc.pdf',
    'application/pdf',
  );
  expect('pdf upload 201', pdfOk.status === 201, pdfOk);
  const pdfUrl = (pdfOk.body as { url: string }).url;
  expect(
    'pdf url under /static/uploads/files/',
    typeof pdfUrl === 'string' &&
      pdfUrl.includes('/static/uploads/files/') &&
      pdfUrl.endsWith('.pdf'),
    pdfUrl,
  );

  // 6. Wrong mime to /files (image) → 400
  const wrongFile = await uploadMultipart(
    '/attachments/files',
    alice.token,
    pngBytes,
    'pic.png',
    'image/png',
  );
  expect('non-pdf to /files 400', wrongFile.status === 400, wrongFile);

  // 7. Image >10MB → 413
  const big = Buffer.alloc(10 * 1024 * 1024 + 100, 0xff);
  const tooBig = await uploadMultipart(
    '/attachments/images',
    alice.token,
    big,
    'big.png',
    'image/png',
  );
  expect('image >10MB 413', tooBig.status === 413, tooBig);

  // 8. PDF >20MB → 413
  const bigPdf = Buffer.alloc(20 * 1024 * 1024 + 100, 0x25);
  const tooBigPdf = await uploadMultipart(
    '/attachments/files',
    alice.token,
    bigPdf,
    'big.pdf',
    'application/pdf',
  );
  expect('pdf >20MB 413', tooBigPdf.status === 413, tooBigPdf);

  // 9. No auth → 401
  const noAuth = await uploadMultipart(
    '/attachments/images',
    null,
    pngBytes,
    'pic.png',
    'image/png',
  );
  expect('no-auth upload 401', noAuth.status === 401, noAuth);

  // 10. Invalid token → 401
  const badAuth = await uploadMultipart(
    '/attachments/images',
    'not-a-real-jwt',
    pngBytes,
    'pic.png',
    'image/png',
  );
  expect('invalid-token upload 401', badAuth.status === 401, badAuth);

  console.log(`\n${pass} passed, ${fail} failed`);
  await prisma.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
