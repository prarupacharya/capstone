import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const jwtSecret = "chat-gateway-test-secret-that-is-at-least-32-characters";
process.env.JWT_SECRET = jwtSecret;
process.env.JWT_EXPIRES_IN = "15m";
process.env.DATABASE_ENABLED = "false";

const { NestFactory } = require("@nestjs/core");
const { JwtService } = require("@nestjs/jwt");
const { io } = require("socket.io-client");
const { AppModule } = require("../dist/app.module.js");
const { ChatGateway } = require("../dist/modules/chat/chat.gateway.js");

let app;
let baseUrl;

before(async () => {
  app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(0);
  const address = app.getHttpServer().address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await app.close();
});

function createToken(overrides = {}, options = {}) {
  const jwt = new JwtService({ secret: jwtSecret });
  return jwt.sign({
    sub: "user-123",
    email: "user@example.com",
    userType: "generaluser",
    ...overrides
  }, options);
}

function connect(token) {
  return new Promise((resolve, reject) => {
    const socket = io(baseUrl, {
      auth: token === undefined ? {} : { token },
      forceNew: true,
      reconnection: false,
      timeout: 1500
    });

    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", (error) => {
      socket.close();
      reject(error);
    });
  });
}

function assertRejected(token) {
  return new Promise((resolve, reject) => {
    const socket = io(baseUrl, {
      auth: token === undefined ? {} : { token },
      forceNew: true,
      reconnection: false,
      timeout: 1500
    });

    socket.once("connect", () => {
      socket.close();
      reject(new Error("invalid client connected"));
    });
    socket.once("connect_error", (error) => {
      socket.close();
      resolve(error);
    });
  });
}

test("a valid JWT connects and attaches only public socket identity", async () => {
  const token = createToken({ password: "must-not-escape" });
  const socket = await connect(token);
  const gateway = app.get(ChatGateway);
  const serverSocket = gateway.server.sockets.sockets.get(socket.id);

  assert.ok(serverSocket);
  assert.deepEqual(serverSocket.data.user, {
    id: "user-123",
    email: "user@example.com",
    userType: "generaluser"
  });
  assert.deepEqual(Object.keys(serverSocket.data), ["user"]);
  socket.close();
});

test("missing, malformed, and expired JWTs are rejected before connection", async () => {
  const expiredToken = createToken({}, { expiresIn: "-1s" });
  const invalidToken = "not-a-jwt-token";

  for (const token of [undefined, invalidToken, expiredToken]) {
    const error = await assertRejected(token);

    assert.equal(error.message, "Unauthorized");
    assert.doesNotMatch(error.message, /not-a-jwt-token/);
  }
});
