import type { ChatMessage } from "./chat-message.types";

export type ChatEventAck<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export interface JoinRoomData {
  chatroomId: string;
  messages: ChatMessage[];
}

export interface RoomNotification {
  chatroomId: string;
  type: "user_joined";
  userId: string;
  identity: string;
  message: string;
  createdAt: string;
}

export interface RoomUserCountUpdated {
  chatroomId: string;
  numberOfUsers: number;
}

export function getChatroomSocketRoom(chatroomId: string) {
  return `chatroom:${chatroomId}`;
}
