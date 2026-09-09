export interface ChatHistoryMessage {
  id: string;
  chatroomId: string;
  sender: string;
  message: string;
  createdAt: string;
}

export type ChatEventAck<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export interface JoinRoomData {
  chatroomId: string;
  messages: ChatHistoryMessage[];
}

export interface LeaveRoomData {
  chatroomId: string;
}

export type JoinRoomAck = ChatEventAck<JoinRoomData>;
export type LeaveRoomAck = ChatEventAck<LeaveRoomData>;
