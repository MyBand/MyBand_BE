import { prisma } from '../utils/prisma';

export interface UpsertGoogleUserInput {
  googleSub: string;
  email: string;
  name: string;
  profileImageUrl: string | null;
}

export interface UpdateUserProfileInput {
  name?: string;
  nickname?: string | null;
  instrument?: string | null;
  profileImageUrl?: string | null;
  onboardingCompleted?: boolean;
}

export class UserRepository {
  findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  }

  findByGoogleSub(googleSub: string) {
    return prisma.user.findUnique({ where: { googleSub } });
  }

  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }

  upsertFromGoogle(input: UpsertGoogleUserInput) {
    return prisma.user.upsert({
      where: { googleSub: input.googleSub },
      update: {
        email: input.email,
        name: input.name,
        profileImageUrl: input.profileImageUrl,
      },
      create: input,
    });
  }

  update(id: string, data: UpdateUserProfileInput) {
    return prisma.user.update({ where: { id }, data });
  }
}
