import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Request,
  Route,
  Security,
  Tags,
} from 'tsoa';
import type { Request as ExpressRequest } from 'express';
import { UserService } from '../services/UserService';
import { UnauthorizedError } from '../errors/HttpError';
import type {
  CompleteOnboardingRequest,
  UpdateUserProfileRequest,
  UserProfileResponse,
} from '../dtos/user.dto';

@Route('users')
@Tags('Users')
@Security('jwt')
export class UserController extends Controller {
  private readonly service = new UserService();

  @Get('me')
  public async getMe(
    @Request() req: ExpressRequest,
  ): Promise<UserProfileResponse> {
    const user = req.user;
    if (!user) throw new UnauthorizedError();
    return this.service.getProfile(user.id);
  }

  @Patch('me')
  public async updateMe(
    @Request() req: ExpressRequest,
    @Body() body: UpdateUserProfileRequest,
  ): Promise<UserProfileResponse> {
    const user = req.user;
    if (!user) throw new UnauthorizedError();
    return this.service.updateProfile(user.id, body);
  }

  @Post('me/onboarding')
  public async completeOnboarding(
    @Request() req: ExpressRequest,
    @Body() body: CompleteOnboardingRequest,
  ): Promise<UserProfileResponse> {
    const user = req.user;
    if (!user) throw new UnauthorizedError();
    return this.service.completeOnboarding(user.id, body);
  }
}
