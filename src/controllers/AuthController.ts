import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  Route,
  Security,
  SuccessResponse,
  Tags,
} from 'tsoa';
import type { Request as ExpressRequest } from 'express';
import { AuthService } from '../services/AuthService';
import { UserService } from '../services/UserService';
import { UnauthorizedError } from '../errors/HttpError';
import type { GoogleLoginRequest, LoginResponse } from '../dtos/auth.dto';
import type { UserProfileResponse } from '../dtos/user.dto';

@Route('auth')
@Tags('Auth')
export class AuthController extends Controller {
  private readonly authService = new AuthService();
  private readonly userService = new UserService();

  @Post('google')
  public async loginWithGoogle(
    @Body() body: GoogleLoginRequest,
  ): Promise<LoginResponse> {
    return this.authService.loginWithGoogle(body);
  }

  @Post('logout')
  @Security('jwt')
  @SuccessResponse(204, 'No Content')
  public async logout(@Request() req: ExpressRequest): Promise<void> {
    const user = req.user;
    if (!user) throw new UnauthorizedError();
    await this.authService.logout(user);
    this.setStatus(204);
  }

  @Get('me')
  @Security('jwt')
  public async me(
    @Request() req: ExpressRequest,
  ): Promise<UserProfileResponse> {
    const user = req.user;
    if (!user) throw new UnauthorizedError();
    return this.userService.getProfile(user.id);
  }
}
