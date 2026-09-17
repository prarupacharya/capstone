import { request } from "./client.js";

export interface ChatroomSummary {
  id: string;
  chatroomName: string;
  createdAt: string;
  numberOfUsers: number;
  isMember?: boolean;
}

export interface CreateChatroomInput {
  chatroomName: string;
}

export async function listChatrooms(): Promise<ChatroomSummary[]> {
  const response = await request("/chatrooms", undefined, { authenticated: true });
  return response.json() as Promise<ChatroomSummary[]>;
}

export async function createChatroom(input: CreateChatroomInput): Promise<ChatroomSummary> {
  const response = await request("/chatrooms", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  }, { authenticated: true });
  return response.json() as Promise<ChatroomSummary>;
}
