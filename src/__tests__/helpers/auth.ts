import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export function makeTestToken(userId?: string): { token: string; userId: string } {
  const id = userId ?? crypto.randomUUID();
  const jti = crypto.randomUUID();
  const token = jwt.sign(
    { sub: id, jti },
    process.env.JWT_SECRET!,
    { expiresIn: '1h' }
  );
  return { token, userId: id };
}
