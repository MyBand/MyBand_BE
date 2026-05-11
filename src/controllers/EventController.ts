import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Path,
  Post,
  Query,
  Request,
  Route,
  Security,
  SuccessResponse,
  Tags,
} from 'tsoa';
import type { Request as ExpressRequest } from 'express';
import { EventService } from '../services/EventService';
import { UnauthorizedError } from '../errors/HttpError';
import type {
  CreateEventRequest,
  EventResponse,
  UpdateEventRequest,
} from '../dtos/event.dto';

@Route('bands/{bandId}/events')
@Tags('Events')
@Security('jwt')
export class EventController extends Controller {
  private readonly service = new EventService();

  @Get()
  public async list(
    @Request() req: ExpressRequest,
    @Path() bandId: string,
    @Query() from?: string,
    @Query() to?: string,
  ): Promise<EventResponse[]> {
    const user = req.user;
    if (!user) throw new UnauthorizedError();
    return this.service.list(bandId, user.id, { from, to });
  }

  @Post()
  @SuccessResponse(201, 'Created')
  public async create(
    @Request() req: ExpressRequest,
    @Path() bandId: string,
    @Body() body: CreateEventRequest,
  ): Promise<EventResponse> {
    const user = req.user;
    if (!user) throw new UnauthorizedError();
    const created = await this.service.create(bandId, user.id, body);
    this.setStatus(201);
    return created;
  }

  @Get('{eventId}')
  public async get(
    @Request() req: ExpressRequest,
    @Path() bandId: string,
    @Path() eventId: string,
  ): Promise<EventResponse> {
    const user = req.user;
    if (!user) throw new UnauthorizedError();
    return this.service.get(bandId, eventId, user.id);
  }

  @Patch('{eventId}')
  public async update(
    @Request() req: ExpressRequest,
    @Path() bandId: string,
    @Path() eventId: string,
    @Body() body: UpdateEventRequest,
  ): Promise<EventResponse> {
    const user = req.user;
    if (!user) throw new UnauthorizedError();
    return this.service.update(bandId, eventId, user.id, body);
  }

  @Delete('{eventId}')
  @SuccessResponse(204, 'No Content')
  public async remove(
    @Request() req: ExpressRequest,
    @Path() bandId: string,
    @Path() eventId: string,
  ): Promise<void> {
    const user = req.user;
    if (!user) throw new UnauthorizedError();
    await this.service.remove(bandId, eventId, user.id);
    this.setStatus(204);
  }
}
