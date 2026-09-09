import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ACCESS_TOKEN_KEY } from "../../../src/auth/session.js";
import { AuthPage } from "../../../src/features/auth/AuthPage.js";

const originalFetch = globalThis.fetch;

function jsonResponse(body: unknown, status = 200) {
  const json = jest.fn<() => Promise<unknown>>();
  json.mockResolvedValue(body);

  return { ok: status >= 200 && status < 300, status, json } as unknown as Response;
}

function installFetch(
  implementation: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
) {
  const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;
  fetchMock.mockImplementation(implementation);
  globalThis.fetch = fetchMock;
  return fetchMock;
}

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe("AuthPage", () => {
  test("starts in registration mode and switches between auth forms", () => {
    render(<AuthPage />);

    expect(screen.getByRole("heading", { name: "Create your account" })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Log in$/ }));
    expect(screen.getByRole("heading", { name: "Log in" })).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /^Register$/ }));
    expect(screen.getByRole("heading", { name: "Create your account" })).not.toBeNull();
  });

  test("transitions to an authenticated session after login and supports logout", async () => {
    const accessToken = "header.payload.signature";
    const fetchMock = installFetch(async (input) => {
      const url = String(input);
      if (url.endsWith("/auth/login")) return jsonResponse({ accessToken });
      if (url.endsWith("/auth/me")) return jsonResponse({ id: "user-123" });
      return jsonResponse({}, 404);
    });
    render(<AuthPage />);
    fireEvent.click(screen.getByRole("button", { name: /^Log in$/ }));
    const loginForm = within(screen.getByRole("form", { name: "Log in" }));
    fireEvent.change(loginForm.getByLabelText("Email"), { target: { value: "user@example.com" } });
    fireEvent.change(loginForm.getByLabelText("Password"), { target: { value: "correct-password" } });
    fireEvent.click(loginForm.getByRole("button", { name: "Log in" }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "You're signed in" })).not.toBeNull());
    expect(window.sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBe(accessToken);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(String(fetchMock.mock.calls[1][0])).toBe("http://localhost:3000/auth/me");

    window.localStorage.setItem(ACCESS_TOKEN_KEY, "legacy-token");
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    expect(screen.getByRole("heading", { name: "Log in" })).not.toBeNull();
    expect(window.sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    expect(window.localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
  });

  test("restores an existing token and probes the protected session", async () => {
    const accessToken = "existing.header.signature";
    window.sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    const fetchMock = installFetch(async () => jsonResponse({ id: "user-123" }));

    render(<AuthPage />);

    expect(screen.getByRole("heading", { name: "You're signed in" })).not.toBeNull();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const headers = fetchMock.mock.calls[0][1]?.headers as Headers;
    expect(headers.get("authorization")).toBe(`Bearer ${accessToken}`);
  });

  test("keeps the authenticated shell when the session probe fails", async () => {
    window.sessionStorage.setItem(ACCESS_TOKEN_KEY, "existing.header.signature");
    const fetchMock = installFetch(async () => {
      throw new Error("session probe offline");
    });

    render(<AuthPage />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("heading", { name: "You're signed in" })).not.toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
