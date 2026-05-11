import crypto from 'crypto';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../utils/env';
import { UserRepository } from '../repositories/UserRepository';
import { RevokedTokenRepository } from '../repositories/RevokedTokenRepository';
import { BadRequestError, UnauthorizedError } from '../errors/HttpError';
import type { AuthUser, GoogleLoginRequest, LoginResponse } from '../dtos/auth.dto';

interface GoogleUserInfo {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

interface JwtAccessPayload {
  sub: string;
  jti: string;
  iat: number;
  exp: number;
}

export interface VerifiedToken {
  id: string;
  jti: string;
  expiresAt: Date;
}

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export class AuthService {
  constructor(
    private readonly users = new UserRepository(),
    private readonly revoked = new RevokedTokenRepository(),
  ) {}

  async loginWithGoogle(body: GoogleLoginRequest): Promise<LoginResponse> {
    const googleUser = body.idToken
      ? await this.verifyIdToken(body.idToken)
      : body.accessToken
        ? await this.fetchUserInfo(body.accessToken)
        : null;

    if (!googleUser) {
      throw new BadRequestError('idToken 또는 accessToken 중 하나는 필수');
    }

    const user = await this.users.upsertFromGoogle({
      googleSub: googleUser.sub,
      email: googleUser.email,
      name: googleUser.name ?? googleUser.email,
      profileImageUrl: googleUser.picture ?? null,
    });

    const accessToken = this.signAccessToken(user.id);

    return {
      accessToken,
      user: toAuthUser(user),
    };
  }

  async logout(token: VerifiedToken): Promise<void> {
    await this.revoked.revoke({
      jti: token.jti,
      userId: token.id,
      expiresAt: token.expiresAt,
    });
  }

  async verifyAccessToken(token: string): Promise<VerifiedToken> {
    let decoded: JwtAccessPayload;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET) as JwtAccessPayload;
    } catch {
      throw new UnauthorizedError('Invalid or expired token');
    }

    if (!decoded.sub || !decoded.jti || !decoded.exp) {
      throw new UnauthorizedError('Malformed token');
    }

    const isRevoked = await this.revoked.isRevoked(decoded.jti);
    if (isRevoked) throw new UnauthorizedError('Token revoked');

    return {
      id: decoded.sub,
      jti: decoded.jti,
      expiresAt: new Date(decoded.exp * 1000),
    };
  }

  private async verifyIdToken(idToken: string): Promise<GoogleUserInfo> {
    let payload: TokenPayload | undefined;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedError('Invalid Google ID token');
    }
    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedError('Google ID token missing required claims');
    }
    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    };
  }

  private async fetchUserInfo(googleAccessToken: string): Promise<GoogleUserInfo> {
    const res = await fetch(
      `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${encodeURIComponent(googleAccessToken)}`,
    );
    if (!res.ok) {
      throw new UnauthorizedError('Invalid Google access token');
    }
    const data = (await res.json()) as {
      sub?: string;
      email?: string;
      name?: string;
      picture?: string;
    };
    if (!data.sub || !data.email) {
      throw new UnauthorizedError('Google userinfo missing required fields');
    }
    return {
      sub: data.sub,
      email: data.email,
      name: data.name,
      picture: data.picture,
    };
  }

  private signAccessToken(userId: string): string {
    const options: SignOptions = {
      expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
      jwtid: crypto.randomUUID(),
    };
    return jwt.sign({ sub: userId }, env.JWT_SECRET, options);
  }
}

function toAuthUser(user: {
  id: string;
  name: string;
  nickname: string | null;
  email: string;
  profileImageUrl: string | null;
  onboardingCompleted: boolean;
}): AuthUser {
  return {
    id: user.id,
    name: user.name,
    nickname: user.nickname,
    email: user.email,
    profileImageUrl: user.profileImageUrl,
    onboardingCompleted: user.onboardingCompleted,
  };
}
