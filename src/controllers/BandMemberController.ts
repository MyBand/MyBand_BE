import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Path,
  Post,
  Request,
  Route,
  Security,
  SuccessResponse,
  Tags,
} from 'tsoa';
import type { Request as ExpressRequest } from 'express';
import { BandMemberService } from '../services/BandMemberService';
import { UnauthorizedError } from '../errors/HttpError';
import type {
  BandMemberResponse,
  InviteBandMemberRequest,
  UpdateBandMemberRequest,
} from '../dtos/bandMember.dto';

@Route('bands/{bandId}/members')
@Tags('BandMembers')
@Security('jwt')
export class BandMemberController extends Controller {
  private readonly service = new BandMemberService();

  @Get()
  public async list(
    @Request() req: ExpressRequest,
    @Path() bandId: string,
  ): Promise<BandMemberResponse[]> {
    const user = req.user;
    if (!user) throw new UnauthorizedError();
    return this.service.listMembers(bandId, user.id);
  }

  @Post()
  @SuccessResponse(201, 'Created')
  public async invite(
    @Request() req: ExpressRequest,
    @Path() bandId: string,
    @Body() body: InviteBandMemberRequest,
  ): Promise<BandMemberResponse> {
    const user = req.user;
    if (!user) throw new UnauthorizedError();
    const created = await this.service.invite(bandId, user.id, body);
    this.setStatus(201);
    return created;
  }

  @Patch('{userId}')
  public async update(
    @Request() req: ExpressRequest,
    @Path() bandId: string,
    @Path() userId: string,
    @Body() body: UpdateBandMemberRequest,
  ): Promise<BandMemberResponse> {
    const user = req.user;
    if (!user) throw new UnauthorizedError();
    return this.service.updateMember(bandId, userId, user.id, body);
  }

  @Delete('{userId}')
  @SuccessResponse(204, 'No Content')
  public async remove(
    @Request() req: ExpressRequest,
    @Path() bandId: string,
    @Path() userId: string,
  ): Promise<void> {
    const user = req.user;
    if (!user) throw new UnauthorizedError();
    await this.service.removeMember(bandId, userId, user.id);
    this.setStatus(204);
  }
}
