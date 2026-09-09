import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import {
  ACCESS_TOKEN_KEY,
  clearAccessToken,
  getAccessToken,
  hasAccessToken,
  saveAccessToken
} from "../../src/auth/session.js";

describe("session access tokens", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  test("saves and reads a token only from tab session storage", () => {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, "legacy-token");

    expect(getAccessToken()).toBeNull();
    expect(hasAccessToken()).toBe(false);

    saveAccessToken("session-token");

    expect(window.sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBe("session-token");
    expect(getAccessToken()).toBe("session-token");
    expect(hasAccessToken()).toBe(true);
    expect(window.localStorage.getItem(ACCESS_TOKEN_KEY)).toBe("legacy-token");
  });

  test("clears the tab token and removes the legacy local token", () => {
    saveAccessToken("session-token");
    window.localStorage.setItem(ACCESS_TOKEN_KEY, "legacy-token");

    clearAccessToken();

    expect(getAccessToken()).toBeNull();
    expect(hasAccessToken()).toBe(false);
    expect(window.sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    expect(window.localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
  });

  test("is safe when no browser window is available", () => {
    jest
      .spyOn(globalThis, "window", "get")
      .mockReturnValue(undefined as unknown as Window & typeof globalThis);

    expect(getAccessToken()).toBeNull();
    expect(hasAccessToken()).toBe(false);
    expect(() => saveAccessToken("session-token")).not.toThrow();
    expect(() => clearAccessToken()).not.toThrow();
  });

  test("ignores unavailable session storage", () => {
    jest.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
      throw new Error("session storage unavailable");
    });

    expect(getAccessToken()).toBeNull();
    expect(hasAccessToken()).toBe(false);
    expect(() => saveAccessToken("session-token")).not.toThrow();
    expect(() => clearAccessToken()).not.toThrow();
  });

  test("ignores storage methods that throw", () => {
    const storage = {
      getItem: jest.fn(() => {
        throw new Error("read failed");
      }),
      setItem: jest.fn(() => {
        throw new Error("write failed");
      }),
      removeItem: jest.fn(() => {
        throw new Error("remove failed");
      })
    } as unknown as Storage;
    jest.spyOn(window, "sessionStorage", "get").mockReturnValue(storage);

    expect(getAccessToken()).toBeNull();
    expect(() => saveAccessToken("session-token")).not.toThrow();
    expect(() => clearAccessToken()).not.toThrow();
  });

  test("ignores an unavailable legacy local storage", () => {
    jest.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new Error("local storage unavailable");
    });

    expect(() => clearAccessToken()).not.toThrow();
  });
});
