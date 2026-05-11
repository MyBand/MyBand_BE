import { prisma } from '../utils/prisma';

export interface CreateBandInput {
  name: string;
  genre?: string | null;
  description?: string | null;
  iconUrl?: string | null;
  inviteCode: string;
}

export interface UpdateBandInput {
  name?: string;
  genre?: string | null;
  description?: string | null;
  iconUrl?: string | null;
}

const withMemberCount = {
  _count: { select: { members: true } },
} as const;

export class BandRepository {
  findByUserId(userId: string) {
    return prisma.band.findMany({
      where: { members: { some: { userId } } },
      orderBy: { createdAt: 'desc' },
      include: withMemberCount,
    });
  }

  findById(id: string) {
    return prisma.band.findUnique({
      where: { id },
      include: withMemberCount,
    });
  }

  findByInviteCode(inviteCode: string) {
    return prisma.band.findUnique({
      where: { inviteCode },
      include: withMemberCount,
    });
  }

  createWithOwner(
    data: CreateBandInput,
    ownerUserId: string,
    instrument?: string | null,
  ) {
    return prisma.$transaction(async (tx) => {
      const band = await tx.band.create({ data });
      await tx.bandMember.create({
        data: {
          bandId: band.id,
          userId: ownerUserId,
          role: 'owner',
          instrument: instrument ?? null,
        },
      });
      const withCount = await tx.band.findUnique({
        where: { id: band.id },
        include: withMemberCount,
      });
      if (!withCount) throw new Error('Band disappeared after creation');
      return withCount;
    });
  }

  update(id: string, data: UpdateBandInput) {
    return prisma.band.update({
      where: { id },
      data,
      include: withMemberCount,
    });
  }

  delete(id: string) {
    return prisma.band.delete({ where: { id } });
  }
}
