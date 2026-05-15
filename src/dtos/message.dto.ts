export type MessageAttachmentType = 'image' | 'pdf';

export interface MessageAttachment {
  type: MessageAttachmentType;
  url: string;
  filename: string;
}

export interface MessageResponse {
  id: string;
  senderId: string;
  senderName: string;
  senderProfileImageUrl: string | null;
  text: string;
  attachments: MessageAttachment[];
  createdAt: string;
}

export interface MessageListResponse {
  messages: MessageResponse[];
  nextCursor: string | null;
}

export interface SendMessageRequest {
  text?: string;
  attachments?: MessageAttachment[];
}
