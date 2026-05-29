import { UserRepository } from '../repositories/UserRepository';
import { BadRequestError, NotFoundError } from '../errors/HttpError';
import { requireOwnUrl } from '../utils/urlValidator';
import { BandService } from './BandService';
import type {
  CompleteOnboardingRequest,
  UpdateUserProfileRequest,
  UserProfileResponse,
} from '../dtos/user.dto';

type UserRow = {
  id: string;
  email: string;
  name: string;
  nickname: string | null;
  profileImageUrl: string | null;
  instrument: string | null;
  onboardingCompleted: boolean;
};

export class UserService {
  constructor(
    private readonly users = new UserRepository(),
    private readonly bands = new BandService(),
  ) {}

  async getProfile(id: string): Promise<UserProfileResponse> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundError(`User ${id} not found`);
    return toResponse(user);
  }

  async updateProfile(
    id: string,
    body: UpdateUserProfileRequest,
  ): Promise<UserProfileResponse> {
    const existing = await this.users.findById(id);
    if (!existing) throw new NotFoundError(`User ${id} not found`);
    requireOwnUrl(body.profileImageUrl, 'profileImageUrl');
    const updated = await this.users.update(id, body);
    return toResponse(updated);
  }

  async completeOnboarding(
    id: string,
    body: CompleteOnboardingRequest,
  ): Promise<UserProfileResponse> {
    const existing = await this.users.findById(id);
    if (!existing) throw new NotFoundError(`User ${id} not found`);

    const nickname = body.nickname.trim();
    const instrument = body.instrument.trim();
    if (!nickname) throw new BadRequestError('nickname is required');
    if (!instrument) throw new BadRequestError('instrument is required');

    const hasInviteCode = body.inviteCode?.trim();
    const hasBand = body.band !== undefined;
    if ((hasInviteCode && hasBand) || (!hasInviteCode && !hasBand)) {
      throw new BadRequestError(
        'Provide exactly one of inviteCode or band',
      );
    }

    if (hasBand) {
      const bandName = body.band!.name.trim();
      if (!bandName) throw new BadRequestError('band.name is required');
      await this.bands.create(
        {
          name: bandName,
          genre: body.band!.genre?.trim() || undefined,
          description: body.band!.description?.trim() || undefined,
          iconUrl: body.band!.iconUrl?.trim() || undefined,
        },
        id,
        instrument,
      );
    } else {
      await this.bands.joinByInviteCode(id, {
        inviteCode: hasInviteCode!,
        instrument,
      });
    }

    const updated = await this.users.update(id, {
      nickname,
      instrument,
      onboardingCompleted: true,
    });
    return toResponse(updated);
  }
}

function toResponse(user: UserRow): UserProfileResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    nickname: user.nickname,
    profileImageUrl: user.profileImageUrl,
    instrument: user.instrument,
    onboardingCompleted: user.onboardingCompleted,
  };
}
