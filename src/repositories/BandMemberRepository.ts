import { prisma } from '../utils/prisma';
import type { BandMemberRole } from '../dtos/bandMember.dto';

export interface CreateBandMemberInput {
  bandId: string;
  userId: string;
  role: BandMemberRole;
  instrument?: string | null;
}

export interface UpdateBandMemberInput {
  role?: BandMemberRole;
  instrument?: string | null;
}

export class BandMemberRepository {
  findByBandAndUser(bandId: string, userId: string) {
    return prisma.bandMember.findUnique({
      where: { bandId_userId: { bandId, userId } },
      include: { user: true },
    });
  }

  findActiveByBandAndUser(bandId: string, userId: string) {
    return prisma.bandMember.findFirst({
      where: { bandId, userId, leftAt: null },
      include: { user: true },
    });
  }

  findByBand(bandId: string) {
    return prisma.bandMember.findMany({
      where: { bandId, leftAt: null },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
      include: { user: true },
    });
  }

  countOwners(bandId: string): Promise<number> {
    return prisma.bandMember.count({
      where: { bandId, role: 'owner', leftAt: null },
    });
  }

  create(input: CreateBandMemberInput) {
    return prisma.bandMember.create({
      data: input,
      include: { user: true },
    });
  }

  restore(input: CreateBandMemberInput) {
    return prisma.bandMember.update({
      where: { bandId_userId: { bandId: input.bandId, userId: input.userId } },
      data: {
        role: input.role,
        instrument: input.instrument ?? null,
        leftAt: null,
      },
      include: { user: true },
    });
  }

  update(bandId: string, userId: string, data: UpdateBandMemberInput) {
    return prisma.bandMember.update({
      where: { bandId_userId: { bandId, userId } },
      data,
      include: { user: true },
    });
  }

  delete(bandId: string, userId: string) {
    return prisma.bandMember.update({
      where: { bandId_userId: { bandId, userId } },
      data: { leftAt: new Date() },
    });
  }
}
