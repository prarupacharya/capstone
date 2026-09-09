import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { ChatGateway } from "./chat.gateway";
import { ChatroomsRepository } from "./chatrooms.repository";
import { WsJwtAuthService } from "./ws-jwt-auth.service";

@Module({
  imports: [AuthModule, DatabaseModule],
  providers: [ChatGateway, ChatroomsRepository, WsJwtAuthService],
  exports: [ChatroomsRepository]
})
export class ChatModule {}
