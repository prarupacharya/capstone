import { request } from "./client.js";

export interface ChatroomSummary {
  id: string;
  chatroomName: string;
  createdAt: string;
  numberOfUsers: number;
  isMember?: boolean;
}

export async function listChatrooms(): Promise<ChatroomSummary[]> {
  const response = await request("/chatrooms", undefined, { authenticated: true });
  return response.json() as Promise<ChatroomSummary[]>;
}
