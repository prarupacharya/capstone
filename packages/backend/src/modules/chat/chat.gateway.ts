import { WebSocketGateway, OnGatewayInit } from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { WsJwtAuthService } from "./ws-jwt-auth.service";

@WebSocketGateway({ cors: { origin: true } })
export class ChatGateway implements OnGatewayInit {
  server!: Server;

  constructor(private readonly wsJwtAuthService: WsJwtAuthService) {}

  afterInit(server: Server) {
    this.server = server;
    server.use((socket, next) => {
      void this.authenticateSocket(socket, next);
    });
  }

  private async authenticateSocket(socket: Socket, next: (error?: Error) => void) {
    try {
      const user = await this.wsJwtAuthService.authenticate(socket.handshake.auth?.token);
      socket.data.user = user;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  }
}
