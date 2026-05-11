import multer from 'multer';
import { BadRequestError } from '../errors/HttpError';

const memoryStorage = multer.memoryStorage();

const ALLOWED_FILE_MIME = 'application/pdf';

const ALLOWED_IMAGE_UPLOAD_MIMES = new Set([
  'application/pdf',
]);

export const imageUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const mime = file.mimetype.toLowerCase();
    if (!mime.startsWith('image/') && !ALLOWED_IMAGE_UPLOAD_MIMES.has(mime)) {
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
    if (file.mimetype.toLowerCase() !== ALLOWED_FILE_MIME) {
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
