import { prisma } from '../utils/prisma';

export interface CreateMessageInput {
  bandId: string;
  senderId: string;
  text: string;
}

export interface ListMessagesOptions {
  bandId: string;
  cursor?: string;
  limit: number;
}

export class MessageRepository {
  create(input: CreateMessageInput) {
    return prisma.message.create({
      data: input,
      include: { sender: true },
    });
  }

  async listByBand(opts: ListMessagesOptions) {
    const take = opts.limit + 1;
    const results = await prisma.message.findMany({
      where: { bandId: opts.bandId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
      include: { sender: true },
    });
    const hasMore = results.length > opts.limit;
    const messages = hasMore ? results.slice(0, opts.limit) : results;
    const nextCursor =
      hasMore && messages.length > 0
        ? messages[messages.length - 1].id
        : null;
    return { messages, nextCursor };
  }
}
