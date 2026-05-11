export interface UserProfileResponse {
  id: string;
  email: string;
  name: string;
  nickname: string | null;
  profileImageUrl: string | null;
  instrument: string | null;
  onboardingCompleted: boolean;
}

export interface UpdateUserProfileRequest {
  name?: string;
  nickname?: string;
  instrument?: string;
  profileImageUrl?: string;
}

export interface OnboardingBandRequest {
  name: string;
  genre?: string;
  description?: string;
  iconUrl?: string;
}

export interface CompleteOnboardingRequest {
  nickname: string;
  instrument: string;
  inviteCode?: string;
  band?: OnboardingBandRequest;
}
