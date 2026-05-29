import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { BadRequestError } from '../errors/HttpError';
import type { AttachmentResponse } from '../dtos/attachment.dto';
import { AttachmentRepository } from '../repositories/AttachmentRepository';

const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads');
const SUBDIR_IMAGES = 'images';
const SUBDIR_FILES = 'files';

const MIME_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/bmp': '.bmp',
  'image/tiff': '.tiff',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'image/avif': '.avif',
  'application/pdf': '.pdf',
};

function ensureDir(p: string): void {
  fs.mkdirSync(p, { recursive: true });
}

function chooseExt(file: Express.Multer.File): string {
  const known = MIME_EXT[file.mimetype.toLowerCase()];
  if (known) return known;
  const orig = path.extname(file.originalname).toLowerCase();
  return orig || '.bin';
}

export class AttachmentService {
  private readonly repo = new AttachmentRepository();

  constructor(private readonly uploadRoot = UPLOAD_ROOT) {
    ensureDir(this.uploadRoot);
    ensureDir(path.join(this.uploadRoot, SUBDIR_IMAGES));
    ensureDir(path.join(this.uploadRoot, SUBDIR_FILES));
  }

  async saveImage(
    file: Express.Multer.File | undefined,
    baseUrl: string,
    uploaderId: string,
    bandId?: string | null,
  ): Promise<AttachmentResponse> {
    return this.save(file, SUBDIR_IMAGES, baseUrl, uploaderId, bandId);
  }

  async saveFile(
    file: Express.Multer.File | undefined,
    baseUrl: string,
    uploaderId: string,
    bandId?: string | null,
  ): Promise<AttachmentResponse> {
    return this.save(file, SUBDIR_FILES, baseUrl, uploaderId, bandId);
  }

  async get(id: string) {
    return this.repo.findById(id);
  }

  private async save(
    file: Express.Multer.File | undefined,
    subdir: string,
    baseUrl: string,
    uploaderId: string,
    bandId?: string | null,
  ): Promise<AttachmentResponse> {
    if (!file) {
      throw new BadRequestError('Missing "file" in multipart form');
    }
    const ext = chooseExt(file);
    const filename = `${crypto.randomUUID()}${ext}`;
    const fullPath = path.join(this.uploadRoot, subdir, filename);
    fs.writeFileSync(fullPath, file.buffer);
    const attachment = await this.repo.create({
      bandId: bandId ?? null,
      uploaderId,
      subdir,
      filename,
      mimeType: file.mimetype,
    });
    return { id: attachment.id, url: `${baseUrl}/attachments/${attachment.id}` };
  }
}
