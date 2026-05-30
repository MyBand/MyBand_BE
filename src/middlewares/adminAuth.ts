import { Request, Response, NextFunction } from 'express';

export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    res.status(503).json({ error: 'Admin access not configured (set ADMIN_SECRET env var)' });
    return;
  }
  const provided = req.headers['x-admin-secret'];
  if (provided !== adminSecret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}
