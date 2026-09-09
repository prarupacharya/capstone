import { Injectable } from "@nestjs/common";
import { ChatroomsRepository } from "./chatrooms.repository";
import type { ChatroomSummary } from "./chatroom.types";

@Injectable()
export class ChatroomsService {
  constructor(
    private readonly chatroomsRepository: ChatroomsRepository
  ) {}

  async listChatrooms(userId: string): Promise<ChatroomSummary[]> {
    return this.chatroomsRepository.listChatroomSummaries(userId);
  }
}
