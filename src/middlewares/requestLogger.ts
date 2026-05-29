import type { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';

const SENSITIVE_PARAMS = ['token', 'access_token', 'id_token', 'refresh_token'];

function sanitizeUrl(url: string): string {
  return url.replace(
    new RegExp(`([?&])(${SENSITIVE_PARAMS.join('|')})=[^&]+`, 'gi'),
    '$1$2=REDACTED',
  );
}

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1_000_000;
    const line = `${req.method} ${sanitizeUrl(req.originalUrl)} ${res.statusCode} ${ms.toFixed(1)}ms`;
    if (res.statusCode >= 500) logger.error(line);
    else if (res.statusCode >= 400) logger.warn(line);
    else logger.info(line);
  });
  next();
}
