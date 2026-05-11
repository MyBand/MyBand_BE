export interface BandResponse {
  id: string;
  name: string;
  genre: string | null;
  description: string | null;
  iconUrl: string | null;
  inviteCode: string;
  memberCount: number;
}

export interface CreateBandRequest {
  name: string;
  genre?: string;
  description?: string;
  iconUrl?: string;
}

export interface UpdateBandRequest {
  name?: string;
  genre?: string;
  description?: string;
  iconUrl?: string;
}

export interface JoinBandRequest {
  inviteCode: string;
  instrument?: string;
}
