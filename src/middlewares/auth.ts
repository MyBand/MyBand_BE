import type { Request } from 'express';
import { UnauthorizedError } from '../errors/HttpError';
import { AuthService, type VerifiedToken } from '../services/AuthService';

const authService = new AuthService();

export type RequestUser = VerifiedToken;

export async function expressAuthentication(
  request: Request,
  securityName: string,
): Promise<RequestUser> {
  if (securityName !== 'jwt') {
    throw new UnauthorizedError(`Unsupported security scheme: ${securityName}`);
  }

  const header = request.header('Authorization');
  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    throw new UnauthorizedError('Missing Bearer token');
  }

  const token = header.slice('bearer '.length).trim();
  if (!token) throw new UnauthorizedError('Missing Bearer token');

  return authService.verifyAccessToken(token);
}
