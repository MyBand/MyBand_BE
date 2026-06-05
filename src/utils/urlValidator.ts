import { BadRequestError } from '../errors/HttpError';

export function requireOwnUrl(url: string | undefined | null, field: string): string | null {
  if (!url) return null;
  const base = (process.env.BASE_URL ?? '').replace(/\/$/, '');
  if (!base) return url;
  if (!url.startsWith(`${base}/api/attachments/`)) {
    throw new BadRequestError(`${field} must point to a file uploaded to this server`);
  }
  return url;
}
