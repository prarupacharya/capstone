export interface ChatMessage {
  id: string;
  chatroomId: string;
  senderId: string;
  senderEmail: string;
  sender: string;
  message: string;
  createdAt: Date;
}

export interface SaveChatMessageInput {
  chatroomId: string;
  fromUserId: string;
  message: string;
}
