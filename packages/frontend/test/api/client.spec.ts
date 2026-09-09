import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { ApiError } from "../../src/api/api-error.js";
import { request } from "../../src/api/client.js";
import { ACCESS_TOKEN_KEY } from "../../src/auth/session.js";

function response(status: number, body: unknown, jsonThrows = false) {
  const json = jest.fn<() => Promise<unknown>>();
  if (jsonThrows) {
    json.mockRejectedValue(new Error("invalid JSON"));
  } else {
    json.mockResolvedValue(body);
  }

  return {
    ok: status >= 200 && status < 300,
    status,
    json
  } as unknown as Response;
}

describe("request", () => {
  let fetchMock: jest.MockedFunction<typeof fetch>;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    window.sessionStorage.clear();
    fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    window.sessionStorage.clear();
  });

  test("passes successful public responses through and preserves headers", async () => {
    const result = response(204, undefined);
    fetchMock.mockResolvedValue(result);

    const returned = await request("/health", {
      method: "POST",
      headers: { "x-correlation-id": "request-123" }
    });

    expect(returned).toBe(result);
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3000/health", {
      method: "POST",
      headers: expect.any(Headers)
    });
    const headers = fetchMock.mock.calls[0][1]?.headers as Headers;
    expect(headers.get("x-correlation-id")).toBe("request-123");
    expect(headers.has("authorization")).toBe(false);
  });

  test("attaches exactly one stored bearer token to protected requests", async () => {
    window.sessionStorage.setItem(ACCESS_TOKEN_KEY, "header.payload.signature");
    fetchMock.mockResolvedValue(response(200, { ok: true }));

    await request(
      "/auth/me",
      { headers: { Authorization: "caller-token", "x-client": "frontend" } },
      { authenticated: true }
    );

    const headers = fetchMock.mock.calls[0][1]?.headers as Headers;
    expect(headers.get("authorization")).toBe("Bearer header.payload.signature");
    expect(headers.get("x-client")).toBe("frontend");
    expect([...headers.keys()].filter((name) => name === "authorization")).toHaveLength(1);
  });

  test("removes caller authorization when a protected request has no session", async () => {
    fetchMock.mockResolvedValue(response(200, { ok: true }));

    await request(
      "/auth/me",
      { headers: { authorization: "caller-token", "x-client": "frontend" } },
      { authenticated: true }
    );

    const headers = fetchMock.mock.calls[0][1]?.headers as Headers;
    expect(headers.has("authorization")).toBe(false);
    expect(headers.get("x-client")).toBe("frontend");
  });

  test("converts an array error response into an ApiError", async () => {
    fetchMock.mockResolvedValue(response(400, { message: ["email is invalid", 42, "password is short"] }));
    const failure = request("/auth/register");

    await expect(failure).rejects.toEqual(
      expect.objectContaining({
        status: 400,
        messages: ["email is invalid", "password is short"]
      })
    );
    await expect(failure).rejects.toBeInstanceOf(ApiError);
  });

  test("converts a string error and redacts the active token", async () => {
    const token = "header.payload.signature";
    window.sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
    fetchMock.mockResolvedValue(response(401, { message: `token rejected: ${token}` }));

    const failure = request("/auth/me", undefined, { authenticated: true });

    await expect(failure).rejects.toMatchObject({
      status: 401,
      messages: [`token rejected: [redacted]`]
    });
    await expect(failure).rejects.not.toThrow(token);
  });

  test("uses a status fallback for malformed or unhelpful error bodies", async () => {
    for (const failedResponse of [
      response(502, undefined, true),
      response(503, null),
      response(504, { message: [7, null] })
    ]) {
      fetchMock.mockResolvedValueOnce(failedResponse);

      await expect(request("/health")).rejects.toMatchObject({
        status: failedResponse.status,
        messages: [`Request failed with status ${failedResponse.status}`]
      });
    }
  });

  test("preserves fetch rejections", async () => {
    const networkError = new Error("network offline");
    fetchMock.mockRejectedValue(networkError);

    await expect(request("/health")).rejects.toBe(networkError);
  });
});
