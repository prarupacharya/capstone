import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { registerUser, loginUser } from "../dist/api-test/api/auth.js";
import { ApiError } from "../dist/api-test/api/api-error.js";
import { request } from "../dist/api-test/api/client.js";
import { ACCESS_TOKEN_KEY } from "../dist/api-test/auth/session.js";

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error
};

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.window = originalWindow;
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
});

function installSessionStorage(accessToken) {
  const values = new Map(accessToken ? [[ACCESS_TOKEN_KEY, accessToken]] : []);
  globalThis.window = {
    sessionStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key)
    }
  };
  return values;
}

function mockResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

test("registration sends only credentials and parses the public user", async () => {
  let request;
  globalThis.fetch = async (url, init) => {
    request = { url, init };
    return mockResponse(201, {
      id: "user-123",
      email: "user@example.com",
      username: null,
      createdDateTime: "2026-01-01T00:00:00.000Z",
      userType: "generaluser"
    });
  };

  const result = await registerUser({
    email: "user@example.com",
    password: "secret-password",
    role: "admin"
  });

  assert.equal(request.url, "http://localhost:3000/auth/register");
  assert.equal(request.init.method, "POST");
  assert.equal(request.init.headers.get("content-type"), "application/json");
  assert.deepEqual(JSON.parse(request.init.body), {
    email: "user@example.com",
    password: "secret-password"
  });
  assert.equal(result.userType, "generaluser");
});

test("login sends only credentials and parses the access token", async () => {
  let request;
  globalThis.fetch = async (url, init) => {
    request = { url, init };
    return mockResponse(200, { accessToken: "signed-token" });
  };

  const result = await loginUser({
    email: "user@example.com",
    password: "secret-password",
    rememberMe: true
  });

  assert.equal(request.url, "http://localhost:3000/auth/login");
  assert.deepEqual(JSON.parse(request.init.body), {
    email: "user@example.com",
    password: "secret-password"
  });
  assert.deepEqual(result, { accessToken: "signed-token" });
});

test("server validation errors expose safe messages without client logging", async () => {
  const logs = [];
  console.log = (...args) => logs.push(args);
  console.warn = (...args) => logs.push(args);
  console.error = (...args) => logs.push(args);
  globalThis.fetch = async () => mockResponse(400, {
    statusCode: 400,
    message: ["email must be an email"],
    error: "Bad Request"
  });

  await assert.rejects(
    registerUser({ email: "invalid", password: "secret-password" }),
    (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 400);
      assert.deepEqual(error.messages, ["email must be an email"]);
      assert.doesNotMatch(error.message, /secret-password/);
      return true;
    }
  );
  assert.equal(logs.length, 0);
});

test("duplicate and unauthorized responses retain status without exposing request data", async () => {
  globalThis.fetch = async (url) => url.endsWith("/register")
    ? mockResponse(400, { message: ["email is already registered"] })
    : mockResponse(401, { message: "invalid email or password" });

  await assert.rejects(registerUser({ email: "used@example.com", password: "secret-password" }), (error) => {
    assert.equal(error.status, 400);
    assert.deepEqual(error.messages, ["email is already registered"]);
    return true;
  });
  await assert.rejects(loginUser({ email: "used@example.com", password: "secret-password" }), (error) => {
    assert.equal(error.status, 401);
    assert.deepEqual(error.messages, ["invalid email or password"]);
    assert.doesNotMatch(error.message, /secret-password/);
    return true;
  });
});

test("protected requests send one session Bearer token and preserve other headers", async () => {
  const accessToken = "header.payload.signature";
  installSessionStorage(accessToken);
  let requestInit;
  globalThis.fetch = async (url, init) => {
    requestInit = { url, init };
    return mockResponse(200, { ok: true });
  };

  await request(
    "/auth/me",
    {
      headers: {
        authorization: "caller-supplied-token",
        "x-correlation-id": "request-123"
      }
    },
    { authenticated: true }
  );

  const headers = requestInit.init.headers;
  assert.equal(headers.get("authorization"), `Bearer ${accessToken}`);
  assert.equal(headers.get("x-correlation-id"), "request-123");
  assert.equal([...headers.keys()].filter((name) => name === "authorization").length, 1);
});

test("protected requests remain token-free without a session", async () => {
  installSessionStorage();
  let requestInit;
  globalThis.fetch = async (_url, init) => {
    requestInit = init;
    return mockResponse(200, { ok: true });
  };

  await request(
    "/auth/me",
    { headers: { Authorization: "caller-supplied-token", "x-client": "frontend" } },
    { authenticated: true }
  );

  const headers = requestInit.headers;
  assert.equal(headers.has("authorization"), false);
  assert.equal(headers.get("x-client"), "frontend");
});

test("public auth requests never inherit a session token", async () => {
  installSessionStorage("header.payload.signature");
  const requests = [];
  globalThis.fetch = async (url, init) => {
    requests.push({ url, init });
    return mockResponse(url.endsWith("/register") ? 201 : 200, url.endsWith("/register")
      ? { id: "user-123", email: "user@example.com" }
      : { accessToken: "new-token" });
  };

  await registerUser({ email: "user@example.com", password: "secret-password" });
  await loginUser({ email: "user@example.com", password: "secret-password" });

  for (const { init } of requests) {
    assert.equal(init.headers.has("authorization"), false);
  }
});

test("protected errors redact the active token and do not log it", async () => {
  const accessToken = "header.payload.signature";
  const logs = [];
  installSessionStorage(accessToken);
  console.log = (...args) => logs.push(args);
  console.warn = (...args) => logs.push(args);
  console.error = (...args) => logs.push(args);
  globalThis.fetch = async () => mockResponse(401, {
    message: `token rejected: ${accessToken}`
  });

  await assert.rejects(
    request("/auth/me", undefined, { authenticated: true }),
    (error) => {
      assert.equal(error.status, 401);
      assert.doesNotMatch(error.message, new RegExp(accessToken));
      assert.match(error.message, /\[redacted\]/);
      return true;
    }
  );
  assert.equal(logs.length, 0);
});
