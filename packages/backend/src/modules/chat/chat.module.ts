import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { ChatGateway } from "./chat.gateway";
import { ChatroomsController } from "./chatrooms.controller";
import { ChatroomsRepository } from "./chatrooms.repository";
import { ChatroomsService } from "./chatrooms.service";
import { RoomPresenceService } from "./room-presence.service";
import { WsJwtAuthService } from "./ws-jwt-auth.service";

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [ChatroomsController],
  providers: [
    ChatGateway,
    ChatroomsRepository,
    ChatroomsService,
    RoomPresenceService,
    WsJwtAuthService
  ],
  exports: [ChatroomsRepository, ChatroomsService, RoomPresenceService]
})
export class ChatModule {}
