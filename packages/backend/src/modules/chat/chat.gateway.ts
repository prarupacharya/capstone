import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { ChatroomsRepository } from "./chatrooms.repository";
import type { WsAuthenticatedUser } from "./ws-jwt-auth.service";
import type { ChatEventAck } from "./chat-events.types";
import { getChatroomSocketRoom } from "./chat-events.types";
import { RoomPresenceService } from "./room-presence.service";
import { UserChatroomsRepository } from "./user-chatrooms.repository";
import { WsJwtAuthService } from "./ws-jwt-auth.service";

@WebSocketGateway({ cors: { origin: true } })
export class ChatGateway implements OnGatewayInit {
  server!: Server;

  constructor(
    private readonly wsJwtAuthService: WsJwtAuthService,
    private readonly chatroomsRepository: ChatroomsRepository,
    private readonly roomPresenceService: RoomPresenceService,
    private readonly userChatroomsRepository: UserChatroomsRepository
  ) {}

  afterInit(server: Server) {
    this.server = server;
    server.use((socket, next) => {
      void this.authenticateSocket(socket, next);
    });
  }

  @SubscribeMessage("joinRoom")
  async joinRoom(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: unknown
  ): Promise<ChatEventAck<{ chatroomId: string }>> {
    const user = (socket.data as { user?: WsAuthenticatedUser }).user;
    if (!user) return this.failure("UNAUTHORIZED", "Unauthorized");

    const chatroomId = this.getChatroomId(payload);
    if (!chatroomId) return this.failure("INVALID_PAYLOAD", "A valid chatroomId is required");

    try {
      if (!await this.chatroomsRepository.findChatroomById(chatroomId)) {
        return this.failure("ROOM_NOT_FOUND", "Chatroom not found");
      }
      if (this.roomPresenceService.hasSocket(chatroomId, user.id, socket.id)) {
        return { ok: true, data: { chatroomId } };
      }

      await socket.join(getChatroomSocketRoom(chatroomId));
      const presence = this.roomPresenceService.join(chatroomId, user.id, socket.id);
      if (presence.becameActive) {
        await this.userChatroomsRepository.beginMembership(user.id, chatroomId);
      }

      return { ok: true, data: { chatroomId } };
    } catch {
      this.roomPresenceService.leave(chatroomId, user.id, socket.id);
      await socket.leave(getChatroomSocketRoom(chatroomId));
      return this.failure("JOIN_FAILED", "Chatroom could not be joined");
    }
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

  private getChatroomId(payload: unknown) {
    if (!payload || typeof payload !== "object") return null;
    const chatroomId = (payload as { chatroomId?: unknown }).chatroomId;
    return typeof chatroomId === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(chatroomId)
      ? chatroomId
      : null;
  }

  private failure(code: string, message: string): ChatEventAck<never> {
    return { ok: false, error: { code, message } };
  }
}
