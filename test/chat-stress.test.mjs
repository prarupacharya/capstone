import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { after, before, test } from "node:test";
import { parseOptions, runStress } from "../scripts/chat-stress.mjs";

const requireBackend = createRequire(new URL("../packages/backend/package.json", import.meta.url));
const { Server } = requireBackend("socket.io");
const generalId = "11111111-1111-4111-8111-111111111111";
const users = new Map();
const messages = [];
let rejectNextSend = false;
let httpServer;
let socketServer;
let baseUrl;

function json(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload));
}

before(async () => {
  httpServer = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
    if (request.url === "/health") return json(response, 200, { status: "up" });
    if (request.url === "/auth/register" && request.method === "POST") {
      if (users.has(body.email)) return json(response, 409, { message: "duplicate" });
      users.set(body.email, body.password);
      return json(response, 201, { email: body.email });
    }
    if (request.url === "/auth/login" && request.method === "POST") {
      if (users.get(body.email) !== body.password) return json(response, 401, { message: "invalid credentials" });
      return json(response, 201, { accessToken: body.email });
    }
    if (request.url === "/chatrooms" && request.method === "GET") {
      if (!users.has(request.headers.authorization?.slice(7))) return json(response, 401, {});
      return json(response, 200, [{ id: generalId, chatroomName: "General" }]);
    }
    return json(response, 404, {});
  });
  socketServer = new Server(httpServer);
  socketServer.use((socket, next) => {
    const email = socket.handshake.auth?.token;
    if (!users.has(email)) return next(new Error("Unauthorized"));
    socket.data.email = email;
    next();
  });
  socketServer.on("connection", (socket) => {
    socket.on("joinRoom", (payload, ack) => {
      if (payload.chatroomId !== generalId) return ack({ ok: false, error: { code: "ROOM_NOT_FOUND" } });
      socket.join(`chatroom:${generalId}`);
      socket.emit("roomUserCountUpdated", { chatroomId: generalId, numberOfUsers: 1 });
      ack({ ok: true, data: { chatroomId: generalId, messages: [] } });
    });
    socket.on("sendMessage", (payload, ack) => {
      if (!socket.rooms.has(`chatroom:${generalId}`)) return ack({ ok: false, error: { code: "NOT_MEMBER" } });
      if (rejectNextSend) {
        rejectNextSend = false;
        return ack({ ok: false, error: { code: "MESSAGE_FAILED" } });
      }
      const saved = {
        id: String(messages.length + 1),
        chatroomId: generalId,
        senderEmail: socket.data.email,
        message: payload.message
      };
      messages.push(saved);
      socket.emit("newMessage", saved);
      ack({ ok: true, data: saved });
    });
  });
  await new Promise((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
});

after(async () => {
  await new Promise((resolve) => socketServer.close(resolve));
});

test("concurrent users register, log in, join General, and send once", async () => {
  const summary = await runStress(parseOptions(["--url", baseUrl, "--users", "4", "--concurrency", "2"]));
  assert.equal(summary.requestedUsers, 4);
  assert.equal(summary.completedUsers, 4);
  assert.equal(summary.failedUsers, 0);
  assert.equal(summary.peakOpenSockets, 4);
  assert.equal(summary.stages.send.passed, 4);
  assert.equal(messages.length, 4);
  assert.equal(new Set(messages.map((message) => message.senderEmail)).size, 4);
});

test("a failed send appears in the summary", async () => {
  rejectNextSend = true;
  const summary = await runStress(parseOptions(["--url", baseUrl, "--users", "1"]));
  assert.equal(summary.completedUsers, 0);
  assert.equal(summary.failedUsers, 1);
  assert.equal(summary.stages.send.failed, 1);
  assert.equal(summary.failureExamples[0].stage, "send");
});
