import type { Server, Socket } from "socket.io";
import { ChatGateway } from "../src/modules/chat/chat.gateway";
import { WsJwtAuthService } from "../src/modules/chat/ws-jwt-auth.service";

function createSocket(token?: unknown) {
  const auth = token === undefined ? {} : { token };

  return {
    handshake: { auth },
    data: {}
  } as unknown as Socket;
}

function createGateway() {
  const authService = { authenticate: jest.fn() };
  const gateway = new ChatGateway(authService as unknown as WsJwtAuthService);
  const server = { use: jest.fn() } as unknown as Server;

  gateway.afterInit(server);
  const middleware = (server.use as jest.Mock).mock.calls[0][0] as (
    socket: Socket,
    next: (error?: Error) => void
  ) => void;

  return { authService, gateway, middleware, server };
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
});
