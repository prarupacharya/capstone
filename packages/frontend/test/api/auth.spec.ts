import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { fileURLToPath } from "node:url";
import type { RegistrationInput } from "../../src/api/auth.js";

const requestMock = jest.fn<
  (path: string, init?: RequestInit, options?: { authenticated?: boolean }) => Promise<Response>
>();

jest.unstable_mockModule(fileURLToPath(new URL("../../src/api/client.ts", import.meta.url)), () => ({
  request: requestMock
}));

const { loginUser, registerUser } = await import("../../src/api/auth.js");

const credentials: RegistrationInput = {
  email: "user@example.com",
  password: "secret-password"
};

const publicUser = {
  id: "user-123",
  email: credentials.email,
  username: null,
  createdDateTime: "2026-01-01T00:00:00.000Z",
  userType: "generaluser"
};

function responseWith(body: unknown) {
  const json = jest.fn<() => Promise<unknown>>();
  json.mockResolvedValue(body);

  return {
    json
  } as unknown as Response;
}

describe("authentication API adapters", () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  test("registerUser posts only credentials and returns the public user", async () => {
    requestMock.mockResolvedValue(responseWith(publicUser));

    const result = await registerUser(credentials);

    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(requestMock).toHaveBeenCalledWith("/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(credentials)
    });
    expect(result).toEqual(publicUser);
  });

  test("loginUser posts only credentials and returns the access token", async () => {
    const loginResult = { accessToken: "signed-token" };
    requestMock.mockResolvedValue(responseWith(loginResult));

    const result = await loginUser(credentials);

    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(requestMock).toHaveBeenCalledWith("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(credentials)
    });
    expect(result).toEqual(loginResult);
  });

  test("does not add authentication options to public adapter calls", async () => {
    requestMock.mockResolvedValue(responseWith(publicUser));

    await registerUser(credentials);

    expect(requestMock.mock.calls[0]).toHaveLength(2);
    expect(requestMock.mock.calls[0][2]).toBeUndefined();
  });
});
