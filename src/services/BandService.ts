import { BandRepository } from '../repositories/BandRepository';
import { BandMemberRepository } from '../repositories/BandMemberRepository';
import { BandMemberService } from './BandMemberService';
import { ConflictError, NotFoundError } from '../errors/HttpError';
import type {
  BandResponse,
  CreateBandRequest,
  JoinBandRequest,
  UpdateBandRequest,
} from '../dtos/band.dto';

type BandRow = {
  id: string;
  name: string;
  genre: string | null;
  description: string | null;
  iconUrl: string | null;
  inviteCode: string;
  _count: { members: number };
};

export class BandService {
  constructor(
    private readonly bands = new BandRepository(),
    private readonly memberService = new BandMemberService(),
    private readonly members = new BandMemberRepository(),
  ) {}

  async listForUser(userId: string): Promise<BandResponse[]> {
    const rows = await this.bands.findByUserId(userId);
    return rows.map(toResponse);
  }

  async get(bandId: string, requesterId: string): Promise<BandResponse> {
    await this.memberService.assertMember(bandId, requesterId);
    const band = await this.bands.findById(bandId);
    if (!band) throw new NotFoundError(`Band ${bandId} not found`);
    return toResponse(band);
  }

  async create(
    input: CreateBandRequest,
    creatorId: string,
    instrument?: string | null,
  ): Promise<BandResponse> {
    const band = await this.createBandWithUniqueInviteCode(input, creatorId, instrument);
    return toResponse(band);
  }

  async joinByInviteCode(
    requesterId: string,
    input: JoinBandRequest,
  ): Promise<BandResponse> {
    const inviteCode = normalizeInviteCode(input.inviteCode);
    const band = await this.bands.findByInviteCode(inviteCode);
    if (!band) throw new NotFoundError('Invalid band invite code');

    const existing = await this.members.findByBandAndUser(band.id, requesterId);
    if (existing?.leftAt === null) {
      throw new ConflictError('User is already a member of this band');
    }

    const memberInput = {
      bandId: band.id,
      userId: requesterId,
      role: 'member',
      instrument: input.instrument ?? null,
    } as const;
    if (existing) {
      await this.members.restore(memberInput);
    } else {
      await this.members.create(memberInput);
    }

    const joined = await this.bands.findById(band.id);
    if (!joined) throw new NotFoundError(`Band ${band.id} not found`);
    return toResponse(joined);
  }

  async update(
    bandId: string,
    requesterId: string,
    input: UpdateBandRequest,
  ): Promise<BandResponse> {
    await this.memberService.assertOwner(bandId, requesterId);
    const updated = await this.bands.update(bandId, input);
    return toResponse(updated);
  }

  async remove(bandId: string, requesterId: string): Promise<void> {
    await this.memberService.assertOwner(bandId, requesterId);
    await this.bands.delete(bandId);
  }

  private async createBandWithUniqueInviteCode(
    input: CreateBandRequest,
    creatorId: string,
    instrument?: string | null,
  ): Promise<BandRow> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return (await this.bands.createWithOwner(
          {
            name: input.name,
            genre: input.genre ?? null,
            description: input.description ?? null,
            iconUrl: input.iconUrl ?? null,
            inviteCode: generateInviteCode(),
          },
          creatorId,
          instrument,
        )) as BandRow;
      } catch (err) {
        if (!isUniqueInviteCodeError(err)) throw err;
      }
    }
    throw new ConflictError('Could not generate a unique invite code');
  }
}

function toResponse(row: BandRow): BandResponse {
  return {
    id: row.id,
    name: row.name,
    genre: row.genre,
    description: row.description,
    iconUrl: row.iconUrl,
    inviteCode: row.inviteCode,
    memberCount: row._count.members,
  };
}

function normalizeInviteCode(code: string): string {
  return code.trim().toUpperCase();
}

function generateInviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function isUniqueInviteCodeError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'P2002'
  );
}
