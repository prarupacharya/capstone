import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { ChatroomsRepository } from "./chatrooms.repository";
import type { WsAuthenticatedUser } from "./ws-jwt-auth.service";
import type {
  ChatEventAck,
  JoinRoomData,
  RoomNotification,
  RoomUserCountUpdated,
  SendMessagePayload
} from "./chat-events.types";
import type { ChatMessage } from "./chat-message.types";
import { getChatroomSocketRoom } from "./chat-events.types";
import { ChatsRepository } from "./chats.repository";
import { RoomPresenceService } from "./room-presence.service";
import { UserChatroomsRepository } from "./user-chatrooms.repository";
import { WsJwtAuthService } from "./ws-jwt-auth.service";

@WebSocketGateway({ cors: { origin: true } })
export class ChatGateway implements OnGatewayInit, OnGatewayDisconnect {
  server!: Server;

  constructor(
    private readonly wsJwtAuthService: WsJwtAuthService,
    private readonly chatroomsRepository: ChatroomsRepository,
    private readonly chatsRepository: ChatsRepository,
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
  ): Promise<ChatEventAck<JoinRoomData>> {
    const user = (socket.data as { user?: WsAuthenticatedUser }).user;
    if (!user) return this.failure("UNAUTHORIZED", "Unauthorized");

    const chatroomId = this.getChatroomId(payload);
    if (!chatroomId) return this.failure("INVALID_PAYLOAD", "A valid chatroomId is required");

    let socketJoined = false;
    let presenceJoined = false;
    let membershipOpened = false;
    try {
      if (!await this.chatroomsRepository.findChatroomById(chatroomId)) {
        return this.failure("ROOM_NOT_FOUND", "Chatroom not found");
      }
      membershipOpened = await this.userChatroomsRepository.beginMembership(user.id, chatroomId);
      if (this.roomPresenceService.hasSocket(chatroomId, user.id, socket.id)) {
        const messages = await this.chatsRepository.listLatestMessages(chatroomId);
        if (membershipOpened) {
          const numberOfUsers = await this.userChatroomsRepository.countActiveMembers(chatroomId);
          this.emitPresenceEvent(
            socket, chatroomId, user, "user_joined", `${user.email} joined the room`, numberOfUsers
          );
        }
        return { ok: true, data: { chatroomId, messages } };
      }

      await socket.join(getChatroomSocketRoom(chatroomId));
      socketJoined = true;
      this.roomPresenceService.join(chatroomId, user.id, socket.id);
      presenceJoined = true;

      const messages = await this.chatsRepository.listLatestMessages(chatroomId);
      if (membershipOpened) {
        const numberOfUsers = await this.userChatroomsRepository.countActiveMembers(chatroomId);
        this.emitPresenceEvent(
          socket, chatroomId, user, "user_joined", `${user.email} joined the room`, numberOfUsers
        );
      }
      return { ok: true, data: { chatroomId, messages } };
    } catch {
      if (membershipOpened) await this.userChatroomsRepository.endMembership(user.id, chatroomId);
      if (presenceJoined) this.roomPresenceService.leave(chatroomId, user.id, socket.id);
      if (socketJoined) await socket.leave(getChatroomSocketRoom(chatroomId));
      return this.failure("JOIN_FAILED", "Chatroom could not be joined");
    }
  }

  @SubscribeMessage("leaveRoom")
  async leaveRoom(
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
      if (!this.roomPresenceService.hasSocket(chatroomId, user.id, socket.id)) {
        return this.failure("NOT_MEMBER", "Socket is not a room member");
      }

      await socket.leave(getChatroomSocketRoom(chatroomId));
      const presence = this.roomPresenceService.leave(chatroomId, user.id, socket.id);
      if (presence.becameInactive) {
        await this.userChatroomsRepository.endMembership(user.id, chatroomId);
        this.emitPresenceEvent(
          socket, chatroomId, user, "user_left", `${user.email} left the room`, presence.numberOfUsers
        );
      }

      return { ok: true, data: { chatroomId } };
    } catch {
      return this.failure("LEAVE_FAILED", "Chatroom could not be left");
    }
  }

  @SubscribeMessage("sendMessage")
  async sendMessage(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: unknown
  ): Promise<ChatEventAck<ChatMessage>> {
    const user = (socket.data as { user?: WsAuthenticatedUser }).user;
    if (!user) return this.failure("UNAUTHORIZED", "Unauthorized");

    const input = this.getSendMessagePayload(payload);
    if (!input) return this.failure("INVALID_PAYLOAD", "A valid message is required");

    try {
      if (!await this.chatroomsRepository.findChatroomById(input.chatroomId)) {
        return this.failure("ROOM_NOT_FOUND", "Chatroom not found");
      }
      if (!this.roomPresenceService.hasSocket(input.chatroomId, user.id, socket.id)) {
        return this.failure("NOT_MEMBER", "Socket is not a room member");
      }

      const saved = await this.chatsRepository.saveMessage({
        chatroomId: input.chatroomId,
        fromUserId: user.id,
        message: input.message
      });
      this.server.to(getChatroomSocketRoom(input.chatroomId)).emit("newMessage", saved);
      return { ok: true, data: saved };
    } catch {
      return this.failure("MESSAGE_FAILED", "Message could not be sent");
    }
  }

  async handleDisconnect(socket: Socket) {
    const user = (socket.data as { user?: WsAuthenticatedUser }).user;
    const changes = this.roomPresenceService.disconnect(socket.id);

    for (const change of changes) {
      if (change.becameInactive) {
        try {
          await this.userChatroomsRepository.endMembership(change.userId, change.roomId);
        } catch {
          // Live presence remains authoritative when history cleanup is unavailable.
        }
        if (user) {
          this.emitPresenceEvent(
            socket, change.roomId, user, "user_left", `${user.email} left the room`, change.numberOfUsers
          );
          continue;
        }
      }
      this.emitUserCount(change.roomId, change.numberOfUsers);
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

  private getSendMessagePayload(payload: unknown): SendMessagePayload | null {
    if (!payload || typeof payload !== "object") return null;
    const chatroomId = this.getChatroomId(payload);
    const message = (payload as { message?: unknown }).message;
    if (!chatroomId || typeof message !== "string") return null;

    const trimmed = message.trim();
    return trimmed.length > 0 && trimmed.length <= 2000
      ? { chatroomId, message: trimmed }
      : null;
  }

  private failure(code: string, message: string): ChatEventAck<never> {
    return { ok: false, error: { code, message } };
  }

  private emitPresenceEvent(
    socket: Socket,
    chatroomId: string,
    user: WsAuthenticatedUser,
    type: RoomNotification["type"],
    message: string,
    numberOfUsers: number
  ) {
    const notification: RoomNotification = {
      chatroomId,
      type,
      userId: user.id,
      identity: user.email,
      message,
      createdAt: new Date().toISOString()
    };
    const count: RoomUserCountUpdated = { chatroomId, numberOfUsers };
    socket.to(getChatroomSocketRoom(chatroomId)).emit("roomNotification", notification);
    this.emitUserCount(count.chatroomId, count.numberOfUsers);
  }

  private emitUserCount(chatroomId: string, numberOfUsers: number) {
    this.server.emit("roomUserCountUpdated", { chatroomId, numberOfUsers });
  }
}
