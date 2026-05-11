import {
  Body,
  Controller,
  Get,
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
import { MessageService } from '../services/MessageService';
import { UnauthorizedError } from '../errors/HttpError';
import type {
  MessageListResponse,
  MessageResponse,
  SendMessageRequest,
} from '../dtos/message.dto';

@Route('bands/{bandId}/messages')
@Tags('Messages')
@Security('jwt')
export class MessageController extends Controller {
  private readonly service = new MessageService();

  @Get()
  public async list(
    @Request() req: ExpressRequest,
    @Path() bandId: string,
    @Query() cursor?: string,
    @Query() limit?: number,
  ): Promise<MessageListResponse> {
    const user = req.user;
    if (!user) throw new UnauthorizedError();
    return this.service.list(bandId, user.id, cursor, limit);
  }

  @Post()
  @SuccessResponse(201, 'Created')
  public async send(
    @Request() req: ExpressRequest,
    @Path() bandId: string,
    @Body() body: SendMessageRequest,
  ): Promise<MessageResponse> {
    const user = req.user;
    if (!user) throw new UnauthorizedError();
    const created = await this.service.send(bandId, user.id, body);
    this.setStatus(201);
    return created;
  }
}
