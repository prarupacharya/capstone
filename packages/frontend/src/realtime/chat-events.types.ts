export type ChatEventAck<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export interface JoinRoomData {
  chatroomId: string;
  messages: unknown[];
}

export interface LeaveRoomData {
  chatroomId: string;
}

export type JoinRoomAck = ChatEventAck<JoinRoomData>;
export type LeaveRoomAck = ChatEventAck<LeaveRoomData>;
