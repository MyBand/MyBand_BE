import { MessageRepository } from '../repositories/MessageRepository';
import { BandMemberService } from './BandMemberService';
import { chatHub } from '../ws/chatHub';
import type {
  MessageListResponse,
  MessageResponse,
  SendMessageRequest,
} from '../dtos/message.dto';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

type MessageRow = {
  id: string;
  bandId: string;
  senderId: string;
  text: string;
  createdAt: Date;
  sender: {
    id: string;
    name: string;
    nickname: string | null;
    profileImageUrl: string | null;
  };
};

export class MessageService {
  constructor(
    private readonly messages = new MessageRepository(),
    private readonly memberService = new BandMemberService(),
  ) {}

  async list(
    bandId: string,
    requesterId: string,
    cursor: string | undefined,
    limit: number | undefined,
  ): Promise<MessageListResponse> {
    await this.memberService.assertMember(bandId, requesterId);
    const effectiveLimit = clamp(limit ?? DEFAULT_LIMIT, 1, MAX_LIMIT);
    const result = await this.messages.listByBand({
      bandId,
      cursor,
      limit: effectiveLimit,
    });
    return {
      messages: (result.messages as MessageRow[]).map(toResponse),
      nextCursor: result.nextCursor,
    };
  }

  async send(
    bandId: string,
    senderId: string,
    body: SendMessageRequest,
  ): Promise<MessageResponse> {
    await this.memberService.assertMember(bandId, senderId);
    const created = await this.messages.create({
      bandId,
      senderId,
      text: body.text,
    });
    const response = toResponse(created as MessageRow);
    chatHub.publish(bandId, response);
    return response;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toResponse(row: MessageRow): MessageResponse {
  return {
    id: row.id,
    senderId: row.senderId,
    senderName: row.sender.nickname ?? row.sender.name,
    senderProfileImageUrl: row.sender.profileImageUrl,
    text: row.text,
    createdAt: row.createdAt.toISOString(),
  };
}
