export type ChatEventAck<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export function getChatroomSocketRoom(chatroomId: string) {
  return `chatroom:${chatroomId}`;
}
