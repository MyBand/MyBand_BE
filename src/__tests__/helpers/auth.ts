import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const TEST_JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-ws-auth-tests';

/**
 * Returns a signed JWT that AuthService.verifyAccessToken will accept,
 * along with the userId embedded in it.
 */
export function makeTestToken(userId = crypto.randomUUID()): { token: string; userId: string } {
  const token = jwt.sign(
    { sub: userId, jti: crypto.randomUUID() },
    TEST_JWT_SECRET,
    { expiresIn: '1h' },
  );
  return { token, userId };
}
