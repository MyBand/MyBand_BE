import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import type { SetlistItem } from '../dtos/event.dto';

export interface DateRange {
  from?: string;
  to?: string;
}

export interface CreateEventInput {
  bandId: string;
  title: string;
  date: string;
  type: string;
  description?: string | null;
  setlist: SetlistItem[];
}

export interface UpdateEventInput {
  title?: string;
  date?: string;
  type?: string;
  description?: string | null;
  setlist?: SetlistItem[];
}

export class EventRepository {
  findByBand(bandId: string, range: DateRange) {
    const where: Prisma.EventWhereInput = { bandId };
    if (range.from || range.to) {
      where.date = {};
      if (range.from) where.date.gte = range.from;
      if (range.to) where.date.lte = range.to;
    }
    return prisma.event.findMany({ where, orderBy: { date: 'asc' } });
  }

  findById(id: string) {
    return prisma.event.findUnique({ where: { id } });
  }

  create(input: CreateEventInput) {
    return prisma.event.create({
      data: {
        bandId: input.bandId,
        title: input.title,
        date: input.date,
        type: input.type,
        description: input.description ?? null,
        setlist: input.setlist as unknown as Prisma.InputJsonValue,
      },
    });
  }

  update(id: string, data: UpdateEventInput) {
    const { setlist, ...rest } = data;
    return prisma.event.update({
      where: { id },
      data: {
        ...rest,
        ...(setlist !== undefined
          ? { setlist: setlist as unknown as Prisma.InputJsonValue }
          : {}),
      },
    });
  }

  delete(id: string) {
    return prisma.event.delete({ where: { id } });
  }
}
