import { prisma } from '../utils/prisma';

export class AttachmentRepository {
  async create(data: {
    bandId?: string | null;
    uploaderId: string;
    subdir: string;
    filename: string;
    mimeType: string;
  }) {
    return prisma.attachment.create({ data });
  }

  async findById(id: string) {
    return prisma.attachment.findUnique({ where: { id } });
  }
}
