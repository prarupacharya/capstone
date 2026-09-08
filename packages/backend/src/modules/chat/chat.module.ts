import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ChatGateway } from "./chat.gateway";
import { WsJwtAuthService } from "./ws-jwt-auth.service";

@Module({
  imports: [AuthModule],
  providers: [ChatGateway, WsJwtAuthService]
})
export class ChatModule {}
