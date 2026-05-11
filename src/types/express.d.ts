import type { RequestUser } from '../middlewares/auth';

declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
    }
  }
}

export {};
