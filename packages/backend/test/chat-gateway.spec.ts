import type { Server, Socket } from "socket.io";
import { ChatGateway } from "../src/modules/chat/chat.gateway";
import type { ChatroomsRepository } from "../src/modules/chat/chatrooms.repository";
import type { ChatsRepository } from "../src/modules/chat/chats.repository";
import type { RoomPresenceService } from "../src/modules/chat/room-presence.service";
import type { UserChatroomsRepository } from "../src/modules/chat/user-chatrooms.repository";
import { WsJwtAuthService } from "../src/modules/chat/ws-jwt-auth.service";

function createSocket(token?: unknown) {
  const auth = token === undefined ? {} : { token };

  return {
    id: "socket-1",
    handshake: { auth },
    data: {},
    join: jest.fn().mockResolvedValue(undefined),
    leave: jest.fn().mockResolvedValue(undefined),
    to: jest.fn().mockReturnValue({ emit: jest.fn() })
  } as unknown as Socket;
}

function createGateway() {
  const authService = { authenticate: jest.fn() };
  const chatroomsRepository = { findChatroomById: jest.fn() };
  const chatsRepository = { listLatestMessages: jest.fn().mockResolvedValue([]) };
  const roomPresenceService = {
    hasSocket: jest.fn(),
    join: jest.fn(),
    leave: jest.fn()
  };
  const userChatroomsRepository = { beginMembership: jest.fn(), endMembership: jest.fn() };
  const gateway = new ChatGateway(
    authService as unknown as WsJwtAuthService,
    chatroomsRepository as unknown as ChatroomsRepository,
    chatsRepository as unknown as ChatsRepository,
    roomPresenceService as unknown as RoomPresenceService,
    userChatroomsRepository as unknown as UserChatroomsRepository
  );
  const server = { use: jest.fn(), emit: jest.fn() } as unknown as Server;

  gateway.afterInit(server);
  const middleware = (server.use as jest.Mock).mock.calls[0][0] as (
    socket: Socket,
    next: (error?: Error) => void
  ) => void;

  return { authService, chatroomsRepository, chatsRepository, roomPresenceService, userChatroomsRepository, gateway, middleware, server };
}

const waitForAuthentication = () =>
  new Promise<void>((resolve) => {
    setImmediate(resolve);
  });

describe("ChatGateway", () => {
  it("registers middleware and stores an authenticated socket user", async () => {
    const { authService, gateway, middleware, server } = createGateway();
    const user = { id: "user-123", email: "user@example.com", userType: "generaluser" };
    const socket = createSocket("valid-token");
    const next = jest.fn();
    authService.authenticate.mockResolvedValue(user);

    expect(gateway.server).toBe(server);
    middleware(socket, next);
    await waitForAuthentication();

    expect(authService.authenticate).toHaveBeenCalledWith("valid-token");
    expect(socket.data.user).toEqual(user);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects sockets when authentication fails without exposing the cause", async () => {
    const { authService, middleware } = createGateway();
    const socket = createSocket("expired-token");
    const next = jest.fn();
    authService.authenticate.mockRejectedValue(new Error("token details"));

    middleware(socket, next);
    await waitForAuthentication();

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: "Unauthorized" }));
    expect(next.mock.calls[0][0].message).not.toContain("token details");
  });

  it("joins an existing room and records first-user membership", async () => {
    const { gateway, chatroomsRepository, chatsRepository, roomPresenceService, userChatroomsRepository, server } = createGateway();
    const socket = createSocket("valid-token");
    socket.data.user = { id: "user-123", email: "user@example.com", userType: "generaluser" };
    const chatroomId = "11111111-1111-4111-8111-111111111111";
    chatroomsRepository.findChatroomById.mockResolvedValue({ id: chatroomId });
    const messages = [{ id: "message-1", chatroomId, sender: "alice", message: "Hello", createdAt: new Date() }];
    chatsRepository.listLatestMessages.mockResolvedValue(messages);
    roomPresenceService.hasSocket.mockReturnValue(false);
    roomPresenceService.join.mockReturnValue({ becameActive: true, numberOfUsers: 1 });

    await expect(gateway.joinRoom(socket, { chatroomId })).resolves.toEqual({
      ok: true, data: { chatroomId, messages }
    });
    expect(socket.join).toHaveBeenCalledWith(`chatroom:${chatroomId}`);
    expect(userChatroomsRepository.beginMembership).toHaveBeenCalledWith("user-123", chatroomId);
    expect(socket.to).toHaveBeenCalledWith(`chatroom:${chatroomId}`);
    expect((socket.to as jest.Mock).mock.results[0].value.emit).toHaveBeenCalledWith(
      "roomNotification",
      expect.objectContaining({
        chatroomId,
        type: "user_joined",
        userId: "user-123",
        identity: "user@example.com",
        message: "user@example.com joined the room",
        createdAt: expect.any(String)
      })
    );
    expect((server.emit as jest.Mock)).toHaveBeenCalledWith(
      "roomUserCountUpdated", { chatroomId, numberOfUsers: 1 }
    );
  });

  it("rejects unauthenticated, malformed, and nonexistent joins", async () => {
    const { gateway, chatroomsRepository } = createGateway();
    const socket = createSocket("valid-token");
    const chatroomId = "11111111-1111-4111-8111-111111111111";

    await expect(gateway.joinRoom(socket, { chatroomId })).resolves.toEqual({
      ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" }
    });
    socket.data.user = { id: "user-123", email: "user@example.com", userType: "generaluser" };
    await expect(gateway.joinRoom(socket, { chatroomId: "not-a-uuid" })).resolves.toMatchObject({ ok: false, error: { code: "INVALID_PAYLOAD" } });
    chatroomsRepository.findChatroomById.mockResolvedValue(null);
    await expect(gateway.joinRoom(socket, { chatroomId })).resolves.toMatchObject({ ok: false, error: { code: "ROOM_NOT_FOUND" } });
  });

  it("does not duplicate membership and rolls back a failed first join", async () => {
    const { gateway, chatroomsRepository, roomPresenceService, userChatroomsRepository } = createGateway();
    const socket = createSocket("valid-token");
    socket.data.user = { id: "user-123", email: "user@example.com", userType: "generaluser" };
    const chatroomId = "11111111-1111-4111-8111-111111111111";
    chatroomsRepository.findChatroomById.mockResolvedValue({ id: chatroomId });
    roomPresenceService.hasSocket.mockReturnValueOnce(true).mockReturnValueOnce(false);
    roomPresenceService.join.mockReturnValue({ becameActive: true });
    userChatroomsRepository.beginMembership.mockRejectedValue(new Error("database unavailable"));

    await expect(gateway.joinRoom(socket, { chatroomId })).resolves.toMatchObject({ ok: true });
    expect(socket.join).not.toHaveBeenCalled();
    await expect(gateway.joinRoom(socket, { chatroomId })).resolves.toMatchObject({
      ok: false, error: { code: "JOIN_FAILED" }
    });
    expect(roomPresenceService.leave).toHaveBeenCalledWith(chatroomId, "user-123", "socket-1");
  });

  it("rolls back a new join when history loading fails", async () => {
    const { gateway, chatroomsRepository, chatsRepository, roomPresenceService, userChatroomsRepository } = createGateway();
    const socket = createSocket("valid-token");
    socket.data.user = { id: "user-123", email: "user@example.com", userType: "generaluser" };
    const chatroomId = "11111111-1111-4111-8111-111111111111";
    chatroomsRepository.findChatroomById.mockResolvedValue({ id: chatroomId });
    roomPresenceService.hasSocket.mockReturnValue(false);
    roomPresenceService.join.mockReturnValue({ becameActive: true });
    chatsRepository.listLatestMessages.mockRejectedValue(new Error("history unavailable"));

    await expect(gateway.joinRoom(socket, { chatroomId })).resolves.toMatchObject({
      ok: false, error: { code: "JOIN_FAILED" }
    });
    expect(userChatroomsRepository.endMembership).toHaveBeenCalledWith("user-123", chatroomId);
    expect(roomPresenceService.leave).toHaveBeenCalledWith(chatroomId, "user-123", "socket-1");
    expect(socket.leave).toHaveBeenCalledWith(`chatroom:${chatroomId}`);
  });

  it("does not announce an additional socket for the same user", async () => {
    const { gateway, chatroomsRepository, roomPresenceService, userChatroomsRepository, server } = createGateway();
    const firstSocket = createSocket("valid-token");
    const secondSocket = createSocket("valid-token");
    const user = { id: "user-123", email: "user@example.com", userType: "generaluser" };
    firstSocket.data.user = user;
    secondSocket.data.user = user;
    const chatroomId = "11111111-1111-4111-8111-111111111111";
    chatroomsRepository.findChatroomById.mockResolvedValue({ id: chatroomId });
    roomPresenceService.hasSocket.mockReturnValueOnce(false).mockReturnValueOnce(true);
    roomPresenceService.join.mockReturnValue({ becameActive: true, numberOfUsers: 1 });

    await gateway.joinRoom(firstSocket, { chatroomId });
    await gateway.joinRoom(secondSocket, { chatroomId });

    expect(userChatroomsRepository.beginMembership).toHaveBeenCalledTimes(1);
    expect(server.emit).toHaveBeenCalledTimes(1);
    expect(secondSocket.to).not.toHaveBeenCalled();
  });
});
