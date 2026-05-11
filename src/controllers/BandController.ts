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
import { BandService } from '../services/BandService';
import { UnauthorizedError } from '../errors/HttpError';
import type {
  BandResponse,
  CreateBandRequest,
  JoinBandRequest,
  UpdateBandRequest,
} from '../dtos/band.dto';

@Route('bands')
@Tags('Bands')
@Security('jwt')
export class BandController extends Controller {
  private readonly service = new BandService();

  @Get()
  public async list(@Request() req: ExpressRequest): Promise<BandResponse[]> {
    const user = req.user;
    if (!user) throw new UnauthorizedError();
    return this.service.listForUser(user.id);
  }

  @Post()
  @SuccessResponse(201, 'Created')
  public async create(
    @Request() req: ExpressRequest,
    @Body() body: CreateBandRequest,
  ): Promise<BandResponse> {
    const user = req.user;
    if (!user) throw new UnauthorizedError();
    const created = await this.service.create(body, user.id);
    this.setStatus(201);
    return created;
  }

  @Post('join')
  public async joinByInviteCode(
    @Request() req: ExpressRequest,
    @Body() body: JoinBandRequest,
  ): Promise<BandResponse> {
    const user = req.user;
    if (!user) throw new UnauthorizedError();
    return this.service.joinByInviteCode(user.id, body);
  }

  @Get('{bandId}')
  public async get(
    @Request() req: ExpressRequest,
    @Path() bandId: string,
  ): Promise<BandResponse> {
    const user = req.user;
    if (!user) throw new UnauthorizedError();
    return this.service.get(bandId, user.id);
  }

  @Patch('{bandId}')
  public async update(
    @Request() req: ExpressRequest,
    @Path() bandId: string,
    @Body() body: UpdateBandRequest,
  ): Promise<BandResponse> {
    const user = req.user;
    if (!user) throw new UnauthorizedError();
    return this.service.update(bandId, user.id, body);
  }

  @Delete('{bandId}')
  @SuccessResponse(204, 'No Content')
  public async remove(
    @Request() req: ExpressRequest,
    @Path() bandId: string,
  ): Promise<void> {
    const user = req.user;
    if (!user) throw new UnauthorizedError();
    await this.service.remove(bandId, user.id);
    this.setStatus(204);
  }
}
