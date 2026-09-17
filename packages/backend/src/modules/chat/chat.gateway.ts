import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { AppLogger, type LogLevel } from "../../common/logging/app-logger";
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
    private readonly userChatroomsRepository: UserChatroomsRepository,
    private readonly logger: AppLogger
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
    if (!user) return this.commandFailure(socket, "joinRoom", "UNAUTHORIZED", "Unauthorized");

    const chatroomId = this.getChatroomId(payload);
    if (!chatroomId) return this.commandFailure(socket, "joinRoom", "INVALID_PAYLOAD", "A valid chatroomId is required");

    let socketJoined = false;
    let presenceJoined = false;
    let membershipOpened = false;
    try {
      if (!await this.chatroomsRepository.findChatroomById(chatroomId)) {
        return this.commandFailure(socket, "joinRoom", "ROOM_NOT_FOUND", "Chatroom not found", chatroomId);
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
        return this.commandSuccess(socket, "joinRoom", { chatroomId, messages });
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
      return this.commandSuccess(socket, "joinRoom", { chatroomId, messages });
    } catch {
      if (membershipOpened) await this.userChatroomsRepository.endMembership(user.id, chatroomId);
      if (presenceJoined) this.roomPresenceService.leave(chatroomId, user.id, socket.id);
      if (socketJoined) await socket.leave(getChatroomSocketRoom(chatroomId));
      return this.commandFailure(socket, "joinRoom", "JOIN_FAILED", "Chatroom could not be joined", chatroomId);
    }
  }

  @SubscribeMessage("leaveRoom")
  async leaveRoom(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: unknown
  ): Promise<ChatEventAck<{ chatroomId: string }>> {
    const user = (socket.data as { user?: WsAuthenticatedUser }).user;
    if (!user) return this.commandFailure(socket, "leaveRoom", "UNAUTHORIZED", "Unauthorized");

    const chatroomId = this.getChatroomId(payload);
    if (!chatroomId) return this.commandFailure(socket, "leaveRoom", "INVALID_PAYLOAD", "A valid chatroomId is required");

    try {
      if (!await this.chatroomsRepository.findChatroomById(chatroomId)) {
        return this.commandFailure(socket, "leaveRoom", "ROOM_NOT_FOUND", "Chatroom not found", chatroomId);
      }
      const membershipEnded = await this.userChatroomsRepository.endMembership(user.id, chatroomId);
      if (!membershipEnded) {
        return this.commandFailure(socket, "leaveRoom", "NOT_MEMBER", "User is not a room member", chatroomId);
      }

      const detachedSocketIds = this.roomPresenceService.detachUserFromRoom(chatroomId, user.id);
      await socket.leave(getChatroomSocketRoom(chatroomId));
      for (const socketId of detachedSocketIds) {
        if (socketId !== socket.id) {
          this.server.in(socketId).socketsLeave(getChatroomSocketRoom(chatroomId));
        }
      }
      const numberOfUsers = await this.userChatroomsRepository.countActiveMembers(chatroomId);
      this.emitPresenceEvent(
        socket, chatroomId, user, "user_left", `${user.email} left the room`, numberOfUsers
      );

      return this.commandSuccess(socket, "leaveRoom", { chatroomId });
    } catch {
      return this.commandFailure(socket, "leaveRoom", "LEAVE_FAILED", "Chatroom could not be left", chatroomId);
    }
  }

  @SubscribeMessage("sendMessage")
  async sendMessage(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: unknown
  ): Promise<ChatEventAck<ChatMessage>> {
    const user = (socket.data as { user?: WsAuthenticatedUser }).user;
    if (!user) return this.commandFailure(socket, "sendMessage", "UNAUTHORIZED", "Unauthorized");

    const input = this.getSendMessagePayload(payload);
    if (!input) return this.commandFailure(socket, "sendMessage", "INVALID_PAYLOAD", "A valid message is required");

    try {
      if (!await this.chatroomsRepository.findChatroomById(input.chatroomId)) {
        return this.commandFailure(socket, "sendMessage", "ROOM_NOT_FOUND", "Chatroom not found", input.chatroomId);
      }
      if (!this.roomPresenceService.hasSocket(input.chatroomId, user.id, socket.id)) {
        return this.commandFailure(socket, "sendMessage", "NOT_MEMBER", "Socket is not a room member", input.chatroomId);
      }

      const saved = await this.chatsRepository.saveMessage({
        chatroomId: input.chatroomId,
        fromUserId: user.id,
        message: input.message
      });
      this.server.to(getChatroomSocketRoom(input.chatroomId)).emit("newMessage", saved);
      return this.commandSuccess(socket, "sendMessage", saved);
    } catch {
      return this.commandFailure(socket, "sendMessage", "MESSAGE_FAILED", "Message could not be sent", input.chatroomId);
    }
  }

  handleDisconnect(socket: Socket) {
    this.roomPresenceService.disconnect(socket.id);
    this.writeSocketLog("INFO", "WebSocket disconnected", {
      event: "disconnect",
      outcome: "completed",
      socketId: socket.id,
      ...this.getUserMetadata(socket)
    });
  }

  private async authenticateSocket(socket: Socket, next: (error?: Error) => void) {
    try {
      const user = await this.wsJwtAuthService.authenticate(socket.handshake.auth?.token);
      socket.data.user = user;
      this.writeSocketLog("INFO", "WebSocket connection accepted", {
        event: "connection",
        outcome: "accepted",
        socketId: socket.id,
        userId: user.id
      });
      next();
    } catch {
      this.writeSocketLog("WARN", "WebSocket connection rejected", {
        event: "connection",
        outcome: "rejected",
        socketId: socket.id,
        errorCode: "UNAUTHORIZED"
      });
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

  private commandSuccess<T>(socket: Socket, event: string, data: T): ChatEventAck<T> {
    this.logCommand(socket, event, "INFO", "success", undefined, this.getChatroomId(data));
    return { ok: true, data };
  }

  private commandFailure(
    socket: Socket,
    event: string,
    code: string,
    message: string,
    chatroomId?: string
  ): ChatEventAck<never> {
    this.logCommand(
      socket,
      event,
      code.endsWith("_FAILED") ? "ERROR" : "WARN",
      "failure",
      code,
      chatroomId
    );
    return { ok: false, error: { code, message } };
  }

  private logCommand(
    socket: Socket,
    event: string,
    level: LogLevel,
    outcome: "success" | "failure",
    errorCode?: string,
    chatroomId?: string | null
  ) {
    this.writeSocketLog(level, `WebSocket ${event} ${outcome}`, {
      event,
      outcome,
      socketId: socket.id,
      ...this.getUserMetadata(socket),
      ...(chatroomId ? { chatroomId } : {}),
      ...(errorCode ? { errorCode } : {})
    });
  }

  private getUserMetadata(socket: Socket) {
    const user = (socket.data as { user?: WsAuthenticatedUser }).user;
    return user ? { userId: user.id } : {};
  }

  private writeSocketLog(level: LogLevel, message: string, metadata: Record<string, unknown>) {
    this.logger.writeToFile("WEBSOCKET", level, message, metadata);
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
