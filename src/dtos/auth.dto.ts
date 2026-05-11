export interface GoogleLoginRequest {
  idToken?: string;
  accessToken?: string;
}

export interface AuthUser {
  id: string;
  name: string;
  nickname: string | null;
  email: string;
  profileImageUrl: string | null;
  onboardingCompleted: boolean;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}
