import { BandMemberRepository } from '../repositories/BandMemberRepository';
import { BandRepository } from '../repositories/BandRepository';
import { UserRepository } from '../repositories/UserRepository';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../errors/HttpError';
import type {
  BandMemberResponse,
  BandMemberRole,
  InviteBandMemberRequest,
  UpdateBandMemberRequest,
} from '../dtos/bandMember.dto';

type MemberRow = {
  bandId: string;
  userId: string;
  role: string;
  instrument: string | null;
  leftAt: Date | null;
  user: {
    id: string;
    name: string;
    nickname: string | null;
    email: string;
    profileImageUrl: string | null;
    instrument: string | null;
  };
};

export class BandMemberService {
  constructor(
    private readonly members = new BandMemberRepository(),
    private readonly bands = new BandRepository(),
    private readonly users = new UserRepository(),
  ) {}

  async assertMember(bandId: string, userId: string): Promise<MemberRow> {
    const band = await this.bands.findById(bandId);
    if (!band) throw new NotFoundError(`Band ${bandId} not found`);
    const membership = await this.members.findActiveByBandAndUser(bandId, userId);
    if (!membership) {
      throw new ForbiddenError('Not a member of this band');
    }
    return membership as MemberRow;
  }

  async assertOwner(bandId: string, userId: string): Promise<MemberRow> {
    const membership = await this.assertMember(bandId, userId);
    if (membership.role !== 'owner') {
      throw new ForbiddenError('Owner role required');
    }
    return membership;
  }

  async listMembers(
    bandId: string,
    requesterId: string,
  ): Promise<BandMemberResponse[]> {
    await this.assertMember(bandId, requesterId);
    const rows = await this.members.findByBand(bandId);
    return rows.map(toResponse);
  }

  async invite(
    bandId: string,
    requesterId: string,
    body: InviteBandMemberRequest,
  ): Promise<BandMemberResponse> {
    await this.assertOwner(bandId, requesterId);

    const invitee = await this.users.findByEmail(body.email);
    if (!invitee) {
      throw new NotFoundError(
        `No user with email ${body.email}; ask them to sign up first`,
      );
    }

    const existing = await this.members.findByBandAndUser(bandId, invitee.id);
    if (existing?.leftAt === null) {
      throw new ConflictError('User is already a member of this band');
    }

    const input = {
      bandId,
      userId: invitee.id,
      role: 'member',
      instrument: body.instrument ?? null,
    } as const;
    const created = existing ? await this.members.restore(input) : await this.members.create(input);
    return toResponse(created as MemberRow);
  }

  async updateMember(
    bandId: string,
    targetUserId: string,
    requesterId: string,
    body: UpdateBandMemberRequest,
  ): Promise<BandMemberResponse> {
    const target = await this.members.findActiveByBandAndUser(bandId, targetUserId);
    if (!target) {
      throw new NotFoundError(`Member ${targetUserId} not in band ${bandId}`);
    }

    const isSelf = requesterId === targetUserId;
    const requester = await this.assertMember(bandId, requesterId);
    const isOwner = requester.role === 'owner';

    if (body.role !== undefined && !isOwner) {
      throw new ForbiddenError('Only owners can change member roles');
    }
    if (!isSelf && !isOwner) {
      throw new ForbiddenError('Only owners can edit other members');
    }

    if (body.role === 'member' && target.role === 'owner') {
      const owners = await this.members.countOwners(bandId);
      if (owners <= 1) {
        throw new ConflictError('Cannot demote the last owner');
      }
    }

    const updated = await this.members.update(bandId, targetUserId, {
      role: body.role,
      instrument: body.instrument,
    });
    return toResponse(updated as MemberRow);
  }

  async removeMember(
    bandId: string,
    targetUserId: string,
    requesterId: string,
  ): Promise<void> {
    const target = await this.members.findActiveByBandAndUser(bandId, targetUserId);
    if (!target) {
      throw new NotFoundError(`Member ${targetUserId} not in band ${bandId}`);
    }

    const isSelf = requesterId === targetUserId;
    if (!isSelf) {
      await this.assertOwner(bandId, requesterId);
    } else {
      await this.assertMember(bandId, requesterId);
    }

    if (target.role === 'owner') {
      const owners = await this.members.countOwners(bandId);
      if (owners <= 1) {
        throw new ConflictError(
          'Cannot remove the last owner; transfer ownership or delete the band',
        );
      }
    }

    await this.members.delete(bandId, targetUserId);
  }
}

function toResponse(row: MemberRow): BandMemberResponse {
  return {
    id: row.user.id,
    name: row.user.nickname ?? row.user.name,
    email: row.user.email,
    profileImageUrl: row.user.profileImageUrl,
    instrument: row.instrument ?? row.user.instrument,
    role: row.role as BandMemberRole,
  };
}
