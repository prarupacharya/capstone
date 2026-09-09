import { Injectable } from "@nestjs/common";
import { ChatroomsRepository } from "./chatrooms.repository";
import { RoomPresenceService } from "./room-presence.service";

export interface ChatroomSummary {
  id: string;
  chatroomName: string;
  createdAt: Date;
  numberOfUsers: number;
}

@Injectable()
export class ChatroomsService {
  constructor(
    private readonly chatroomsRepository: ChatroomsRepository,
    private readonly roomPresenceService: RoomPresenceService
  ) {}

  async listChatrooms(): Promise<ChatroomSummary[]> {
    const rooms = await this.chatroomsRepository.listChatrooms();

    return rooms.map((room) => ({
      ...room,
      numberOfUsers: this.roomPresenceService.getUserCount(room.id)
    }));
  }
}
