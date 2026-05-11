export type BandMemberRole = 'owner' | 'member';

export interface BandMemberResponse {
  id: string;
  name: string;
  email: string;
  instrument: string | null;
  profileImageUrl: string | null;
  role: BandMemberRole;
}

export interface InviteBandMemberRequest {
  email: string;
  instrument?: string;
}

export interface UpdateBandMemberRequest {
  instrument?: string;
  role?: BandMemberRole;
}
