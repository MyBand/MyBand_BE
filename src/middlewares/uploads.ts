import multer from 'multer';
import { BadRequestError } from '../errors/HttpError';

const memoryStorage = multer.memoryStorage();

const ALLOWED_FILE_MIME = 'application/pdf';

const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.bmp',
  '.svg',
  '.tiff',
  '.heic',
  '.heif',
  '.avif',
]);

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot).toLowerCase() : '';
}

export const imageUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const mime = file.mimetype.toLowerCase();
    const ext = extensionOf(file.originalname);
    const isOctetStream = mime === 'application/octet-stream';
    const isAllowed =
      mime.startsWith('image/') ||
      (isOctetStream && IMAGE_EXTENSIONS.has(ext));

    if (!isAllowed) {
      cb(
        new BadRequestError(
          `Unsupported file type: ${file.mimetype}`,
        ),
      );
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
    const isAllowed =
      mime === ALLOWED_FILE_MIME ||
      (mime === 'application/octet-stream' && ext === '.pdf');

    if (!isAllowed) {
      cb(
        new BadRequestError(
          `Unsupported file mime type: ${file.mimetype} (only ${ALLOWED_FILE_MIME})`,
        ),
      );
      return;
    }
    cb(null, true);
  },
});
