import type { ChatMessage } from "./chat-message.types";

export type ChatEventAck<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export interface JoinRoomData {
  chatroomId: string;
  messages: ChatMessage[];
}

export function getChatroomSocketRoom(chatroomId: string) {
  return `chatroom:${chatroomId}`;
}
