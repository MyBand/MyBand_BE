import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { prisma } from './utils/prisma';
import { adminAuth } from './middlewares/adminAuth';

const router = Router();
const uploadsDir = path.resolve(process.cwd(), 'uploads');

// Accepts X-Admin-Secret header OR ?secret= query param so browser <img>/<a> tags work.
function adminAuthFlex(req: Request, res: Response, next: NextFunction): void {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    res.status(503).json({ error: 'Admin access not configured (set ADMIN_SECRET env var)' });
    return;
  }
  const fromHeader = req.headers['x-admin-secret'];
  const fromQuery = req.query['secret'];
  const provided =
    (typeof fromHeader === 'string' ? fromHeader : undefined) ??
    (typeof fromQuery === 'string' ? fromQuery : undefined);
  if (provided !== adminSecret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

router.get('/stats', adminAuth, async (_req, res) => {
  const [users, bands, events, messages, activeMembers, imageCount, pdfCount] = await Promise.all([
    prisma.user.count(),
    prisma.band.count(),
    prisma.event.count(),
    prisma.message.count(),
    prisma.bandMember.count({ where: { leftAt: null } }),
    prisma.attachment.count({ where: { subdir: 'images' } }),
    prisma.attachment.count({ where: { subdir: 'files' } }),
  ]);

  res.json({ users, bands, events, messages, activeMembers, files: { images: imageCount, pdfs: pdfCount } });
});

router.get('/users', adminAuth, async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { bandMemberships: true, messages: true } },
    },
  });
  res.json(users);
});

router.delete('/users/:id', adminAuth, async (req, res) => {
  await prisma.user.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

router.get('/bands', adminAuth, async (_req, res) => {
  const bands = await prisma.band.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { members: true, events: true, messages: true } },
    },
  });
  res.json(bands);
});

router.delete('/bands/:id', adminAuth, async (req, res) => {
  await prisma.band.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

router.get('/files', adminAuth, async (_req, res) => {
  const attachments = await prisma.attachment.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      uploader: { select: { id: true, name: true, email: true } },
    },
  });

  const withSize = attachments.map((a) => {
    const diskPath = path.join(uploadsDir, a.subdir, a.filename);
    const size = fs.existsSync(diskPath) ? fs.statSync(diskPath).size : 0;
    return {
      id: a.id,
      filename: a.filename,
      mimeType: a.mimeType,
      size,
      createdAt: a.createdAt,
      type: a.subdir === 'images' ? 'image' : 'pdf',
      bandId: a.bandId,
      uploader: a.uploader,
    };
  });

  res.json({
    images: withSize.filter((a) => a.type === 'image'),
    pdfs: withSize.filter((a) => a.type === 'pdf'),
  });
});

// Serves file by attachment ID — accepts ?secret= so browser <img src> and <a href> work.
router.get('/files/:id', adminAuthFlex, async (req, res) => {
  const attachment = await prisma.attachment.findUnique({ where: { id: req.params.id } });
  if (!attachment) {
    res.status(404).json({ error: 'Attachment not found' });
    return;
  }
  const diskPath = path.join(uploadsDir, attachment.subdir, attachment.filename);
  if (!fs.existsSync(diskPath)) {
    res.status(404).json({ error: 'File not found on disk' });
    return;
  }
  res.sendFile(diskPath);
});

router.delete('/files/:id', adminAuth, async (req, res) => {
  const attachment = await prisma.attachment.findUnique({ where: { id: req.params.id } });
  if (!attachment) {
    res.status(404).json({ error: 'Attachment not found' });
    return;
  }
  const diskPath = path.join(uploadsDir, attachment.subdir, attachment.filename);
  if (fs.existsSync(diskPath)) fs.unlinkSync(diskPath);
  await prisma.attachment.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

export default router;
