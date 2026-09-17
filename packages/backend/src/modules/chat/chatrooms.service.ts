import { ConflictException, Injectable } from "@nestjs/common";
import { ChatroomsRepository } from "./chatrooms.repository";
import type { ChatroomSummary } from "./chatroom.types";
import type { CreateChatroomDto } from "./dto/create-chatroom.dto";

function isDuplicateChatroomNameError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const databaseError = error as { code?: unknown; constraint?: unknown };
  return databaseError.code === "23505" && databaseError.constraint === "chatrooms_name_unique";
}

@Injectable()
export class ChatroomsService {
  constructor(
    private readonly chatroomsRepository: ChatroomsRepository
  ) {}

  async createChatroom(input: CreateChatroomDto): Promise<ChatroomSummary> {
    try {
      const chatroom = await this.chatroomsRepository.createChatroom(input.chatroomName);
      return { ...chatroom, numberOfUsers: 0, isMember: false };
    } catch (error) {
      if (isDuplicateChatroomNameError(error)) {
        throw new ConflictException("chatroom name is already in use");
      }

      throw error;
    }
  }

  async listChatrooms(userId: string): Promise<ChatroomSummary[]> {
    return this.chatroomsRepository.listChatroomSummaries(userId);
  }
}
