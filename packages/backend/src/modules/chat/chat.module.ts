import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { ChatGateway } from "./chat.gateway";
import { ChatroomsRepository } from "./chatrooms.repository";
import { RoomPresenceService } from "./room-presence.service";
import { WsJwtAuthService } from "./ws-jwt-auth.service";

@Module({
  imports: [AuthModule, DatabaseModule],
  providers: [ChatGateway, ChatroomsRepository, RoomPresenceService, WsJwtAuthService],
  exports: [ChatroomsRepository, RoomPresenceService]
})
export class ChatModule {}
