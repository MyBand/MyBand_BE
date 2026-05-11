import type { NextFunction, Request, Response } from 'express';
import { ValidateError } from 'tsoa';
import { MulterError } from 'multer';
import { HttpError } from '../errors/HttpError';
import { logger } from '../utils/logger';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof ValidateError) {
    res.status(422).json({
      message: 'Validation Failed',
      details: err.fields,
    });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.statusCode).json({ message: err.message });
    return;
  }

  if (err instanceof MulterError) {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    res.status(status).json({ message: err.message, code: err.code });
    return;
  }

  logger.error('Unhandled error', err);
  res.status(500).json({ message: 'Internal Server Error' });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ message: 'Resource not found' });
}
