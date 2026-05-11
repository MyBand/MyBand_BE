export interface MessageResponse {
  id: string;
  senderId: string;
  senderName: string;
  senderProfileImageUrl: string | null;
  text: string;
  createdAt: string;
}

export interface MessageListResponse {
  messages: MessageResponse[];
  nextCursor: string | null;
}

export interface SendMessageRequest {
  text: string;
}
