import {
  Controller,
  Post,
  Request,
  Route,
  Security,
  SuccessResponse,
  Tags,
} from 'tsoa';
import type { Request as ExpressRequest } from 'express';
import { AttachmentService } from '../services/AttachmentService';
import { UnauthorizedError } from '../errors/HttpError';
import type { AttachmentResponse } from '../dtos/attachment.dto';

@Route('attachments')
@Tags('Attachments')
@Security('jwt')
export class AttachmentController extends Controller {
  private readonly service = new AttachmentService();

  @Post('images')
  @SuccessResponse(201, 'Created')
  public async uploadImage(
    @Request() req: ExpressRequest,
  ): Promise<AttachmentResponse> {
    if (!req.user) throw new UnauthorizedError();
    const out = this.service.saveImage(req.file, baseUrlFrom(req));
    this.setStatus(201);
    return out;
  }

  @Post('files')
  @SuccessResponse(201, 'Created')
  public async uploadFile(
    @Request() req: ExpressRequest,
  ): Promise<AttachmentResponse> {
    if (!req.user) throw new UnauthorizedError();
    const out = this.service.saveFile(req.file, baseUrlFrom(req));
    this.setStatus(201);
    return out;
  }
}

function baseUrlFrom(req: ExpressRequest): string {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, '');
  const forwarded = req.headers['x-forwarded-proto'] as string | undefined;
  const proto = forwarded ? forwarded.split(',')[0].trim() : req.protocol;
  return `${proto}://${req.get('host')}`;
}
