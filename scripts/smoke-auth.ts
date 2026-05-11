import 'dotenv/config';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../src/utils/prisma';

async function main() {
  const secret = process.env.JWT_SECRET!;
  const googleSub = `smoke-${crypto.randomBytes(4).toString('hex')}`;

  const user = await prisma.user.create({
    data: {
      googleSub,
      email: `${googleSub}@example.com`,
      name: 'Smoke Tester',
    },
  });

  const jti = crypto.randomUUID();
  const token = jwt.sign({ sub: user.id }, secret, {
    expiresIn: '1h',
    jwtid: jti,
  });

  console.log(JSON.stringify({ userId: user.id, token }));
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
