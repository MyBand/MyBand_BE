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

  findByBand(bandId: string) {
    return prisma.bandMember.findMany({
      where: { bandId },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
      include: { user: true },
    });
  }

  countOwners(bandId: string): Promise<number> {
    return prisma.bandMember.count({
      where: { bandId, role: 'owner' },
    });
  }

  create(input: CreateBandMemberInput) {
    return prisma.bandMember.create({
      data: input,
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
    return prisma.bandMember.delete({
      where: { bandId_userId: { bandId, userId } },
    });
  }
}
