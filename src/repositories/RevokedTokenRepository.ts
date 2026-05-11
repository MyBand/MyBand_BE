import { prisma } from '../utils/prisma';

export interface RevokeTokenInput {
  jti: string;
  userId: string;
  expiresAt: Date;
}

export class RevokedTokenRepository {
  async isRevoked(jti: string): Promise<boolean> {
    const found = await prisma.revokedToken.findUnique({ where: { jti } });
    return !!found;
  }

  revoke(input: RevokeTokenInput) {
    return prisma.revokedToken.create({ data: input });
  }
}
