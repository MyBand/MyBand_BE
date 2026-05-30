import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { prisma } from './utils/prisma';
import { adminAuth } from './middlewares/adminAuth';

const router = Router();
const uploadsDir = path.resolve(process.cwd(), 'uploads');

router.use(adminAuth);

router.get('/stats', async (_req, res) => {
  const [users, bands, events, messages, activeMembers] = await Promise.all([
    prisma.user.count(),
    prisma.band.count(),
    prisma.event.count(),
    prisma.message.count(),
    prisma.bandMember.count({ where: { leftAt: null } }),
  ]);

  const imagesDir = path.join(uploadsDir, 'images');
  const filesDir = path.join(uploadsDir, 'files');
  const imageCount = fs.existsSync(imagesDir) ? fs.readdirSync(imagesDir).length : 0;
  const pdfCount = fs.existsSync(filesDir) ? fs.readdirSync(filesDir).length : 0;

  res.json({ users, bands, events, messages, activeMembers, files: { images: imageCount, pdfs: pdfCount } });
});

router.get('/users', async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { bandMemberships: true, messages: true } },
    },
  });
  res.json(users);
});

router.delete('/users/:id', async (req, res) => {
  await prisma.user.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

router.get('/bands', async (_req, res) => {
  const bands = await prisma.band.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { members: true, events: true, messages: true } },
    },
  });
  res.json(bands);
});

router.delete('/bands/:id', async (req, res) => {
  await prisma.band.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

router.get('/files', (_req, res) => {
  const imagesDir = path.join(uploadsDir, 'images');
  const filesDir = path.join(uploadsDir, 'files');

  const baseUrl = process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;

  const images = fs.existsSync(imagesDir)
    ? fs.readdirSync(imagesDir).map((filename) => {
        const stat = fs.statSync(path.join(imagesDir, filename));
        return {
          filename,
          size: stat.size,
          createdAt: stat.birthtime,
          type: 'image',
          url: `${baseUrl}/static/uploads/images/${filename}`,
        };
      })
    : [];

  const pdfs = fs.existsSync(filesDir)
    ? fs.readdirSync(filesDir).map((filename) => {
        const stat = fs.statSync(path.join(filesDir, filename));
        return {
          filename,
          size: stat.size,
          createdAt: stat.birthtime,
          type: 'pdf',
          url: `${baseUrl}/static/uploads/files/${filename}`,
        };
      })
    : [];

  res.json({ images, pdfs });
});

router.delete('/files/:type/:filename', (req, res) => {
  const { type, filename } = req.params;
  if (!['images', 'files'].includes(type)) {
    res.status(400).json({ error: 'Invalid type. Must be "images" or "files".' });
    return;
  }
  if (filename.includes('/') || filename.includes('..') || filename.includes('\0')) {
    res.status(400).json({ error: 'Invalid filename' });
    return;
  }
  const filePath = path.join(uploadsDir, type, filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'File not found' });
    return;
  }
  fs.unlinkSync(filePath);
  res.json({ success: true });
});

export default router;
