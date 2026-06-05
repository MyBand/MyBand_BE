import path from 'path';
import fs from 'fs';
import {
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
import { AttachmentService } from '../services/AttachmentService';
import { AuthService } from '../services/AuthService';
import { UnauthorizedError } from '../errors/HttpError';
import type { AttachmentResponse } from '../dtos/attachment.dto';

@Route('attachments')
@Tags('Attachments')
export class AttachmentController extends Controller {
  private readonly service = new AttachmentService();
  private readonly authService = new AuthService();

  @Post('images')
  @Security('jwt')
  @SuccessResponse(201, 'Created')
  public async uploadImage(
    @Request() req: ExpressRequest,
    @Query() bandId?: string,
  ): Promise<AttachmentResponse> {
    if (!req.user) throw new UnauthorizedError();
    const out = await this.service.saveImage(req.file, baseUrlFrom(req), req.user.id, bandId);
    this.setStatus(201);
    return out;
  }

  @Post('files')
  @Security('jwt')
  @SuccessResponse(201, 'Created')
  public async uploadFile(
    @Request() req: ExpressRequest,
    @Query() bandId?: string,
  ): Promise<AttachmentResponse> {
    if (!req.user) throw new UnauthorizedError();
    const out = await this.service.saveFile(req.file, baseUrlFrom(req), req.user.id, bandId);
    this.setStatus(201);
    return out;
  }

  /**
   * Serve an attachment file. Accepts a JWT via Authorization header or ?token= query param
   * so the URL can be embedded directly in <img> tags and download links.
   */
  @Get('{id}')
  public async serve(
    @Path() id: string,
    @Request() req: ExpressRequest,
    @Query() token?: string,
  ): Promise<void> {
    const res = (req as any).res as import('express').Response;

    // Accept Bearer token from Authorization header or ?token= query param
    const header = req.headers['authorization'];
    const rawToken =
      (header?.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : null) ??
      token ??
      null;

    if (!rawToken) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    let userId: string;
    try {
      const verified = await this.authService.verifyAccessToken(rawToken);
      userId = verified.id;
    } catch {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const attachment = await this.service.get(id);
    if (!attachment) {
      res.status(404).json({ message: 'Attachment not found' });
      return;
    }

    if (attachment.bandId) {
      const { BandMemberRepository } = await import('../repositories/BandMemberRepository');
      const memberRepo = new BandMemberRepository();
      const member = await memberRepo.findByBandAndUser(attachment.bandId, userId);
      if (!member || member.leftAt !== null) {
        res.status(403).json({ message: 'Forbidden' });
        return;
      }
    }

    const uploadRoot = path.resolve(process.cwd(), 'uploads');
    const fullPath = path.join(uploadRoot, attachment.subdir, attachment.filename);
    await new Promise<void>((resolve, reject) => {
      res.sendFile(fullPath, { dotfiles: 'allow' }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

function baseUrlFrom(req: ExpressRequest): string {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, '');
  const forwarded = req.headers['x-forwarded-proto'] as string | undefined;
  const proto = forwarded ? forwarded.split(',')[0].trim() : req.protocol;
  return `${proto}://${req.get('host')}`;
}
