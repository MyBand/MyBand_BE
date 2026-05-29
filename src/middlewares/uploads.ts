import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { BadRequestError } from '../errors/HttpError';

const memoryStorage = multer.memoryStorage();

const IMAGE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.bmp', '.tiff', '.heic', '.heif', '.avif',
]);

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot).toLowerCase() : '';
}

// ---------------------------------------------------------------------------
// Magic-byte detection — runs on the buffered file content after multer.
// Returns a normalised MIME string or null if the signature is unrecognised.
// ---------------------------------------------------------------------------
function detectMime(buf: Buffer): string | null {
  if (buf.length < 4) return null;

  // JPEG: FF D8 FF
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'image/jpeg';

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'image/png';

  // GIF: GIF87a / GIF89a
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'image/gif';

  // WEBP: RIFF....WEBP
  if (buf.length >= 12 &&
      buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'image/webp';

  // BMP: BM
  if (buf[0] === 0x42 && buf[1] === 0x4D) return 'image/bmp';

  // TIFF: little-endian (II*\0) or big-endian (MM\0*)
  if ((buf[0] === 0x49 && buf[1] === 0x49 && buf[2] === 0x2A && buf[3] === 0x00) ||
      (buf[0] === 0x4D && buf[1] === 0x4D && buf[2] === 0x00 && buf[3] === 0x2A)) return 'image/tiff';

  // HEIC / HEIF / AVIF: ISO Base Media (ftyp box at offset 4)
  if (buf.length >= 12 && buf.slice(4, 8).toString('ascii') === 'ftyp') {
    const brand = buf.slice(8, 12).toString('ascii').toLowerCase();
    if (['heic', 'heix', 'hevc', 'hevx'].includes(brand)) return 'image/heic';
    if (['mif1', 'msf1'].includes(brand)) return 'image/heif';
    if (['avif', 'avis'].includes(brand)) return 'image/avif';
  }

  // PDF: %PDF
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return 'application/pdf';

  return null;
}

// ---------------------------------------------------------------------------
// Multer instances — fileFilter does a fast client-header pre-check so that
// obviously wrong types are rejected before the file is buffered.
// ---------------------------------------------------------------------------

export const imageUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const mime = file.mimetype.toLowerCase();
    const ext = extensionOf(file.originalname);
    const allowed =
      mime.startsWith('image/') ||
      (mime === 'application/octet-stream' && IMAGE_EXTENSIONS.has(ext));
    if (!allowed) {
      cb(new BadRequestError(`Unsupported file type: ${file.mimetype}`));
      return;
    }
    cb(null, true);
  },
});

export const fileUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const mime = file.mimetype.toLowerCase();
    const ext = extensionOf(file.originalname);
    const allowed =
      mime === 'application/pdf' ||
      (mime === 'application/octet-stream' && ext === '.pdf');
    if (!allowed) {
      cb(new BadRequestError(`Unsupported file type: ${file.mimetype} (only application/pdf)`));
      return;
    }
    cb(null, true);
  },
});

// ---------------------------------------------------------------------------
// Post-multer magic-byte verification middlewares.
// These run after the file is fully buffered and correct file.mimetype so
// that AttachmentService picks the right extension even for octet-stream uploads.
// ---------------------------------------------------------------------------

export function verifyImageMime(req: Request, _res: Response, next: NextFunction): void {
  const file = req.file;
  if (!file) { next(); return; }

  const detected = detectMime(file.buffer);
  if (!detected || !detected.startsWith('image/')) {
    next(new BadRequestError('File content does not match a supported image format'));
    return;
  }
  file.mimetype = detected;
  next();
}

export function verifyFileMime(req: Request, _res: Response, next: NextFunction): void {
  const file = req.file;
  if (!file) { next(); return; }

  const detected = detectMime(file.buffer);
  if (detected !== 'application/pdf') {
    next(new BadRequestError('File content is not a valid PDF'));
    return;
  }
  file.mimetype = detected;
  next();
}
