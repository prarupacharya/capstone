import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { ChatGateway } from "./chat.gateway";
import { ChatroomsController } from "./chatrooms.controller";
import { ChatroomsRepository } from "./chatrooms.repository";
import { ChatroomsService } from "./chatrooms.service";
import { ChatsRepository } from "./chats.repository";
import { RoomPresenceService } from "./room-presence.service";
import { UserChatroomsRepository } from "./user-chatrooms.repository";
import { WsJwtAuthService } from "./ws-jwt-auth.service";

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [ChatroomsController],
  providers: [
    ChatGateway,
    ChatsRepository,
    ChatroomsRepository,
    ChatroomsService,
    RoomPresenceService,
    UserChatroomsRepository,
    WsJwtAuthService
  ],
  exports: [
    ChatsRepository,
    ChatroomsRepository,
    ChatroomsService,
    RoomPresenceService,
    UserChatroomsRepository
  ]
})
export class ChatModule {}
