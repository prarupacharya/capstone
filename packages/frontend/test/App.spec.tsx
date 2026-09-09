import { afterEach, expect, jest, test } from "@jest/globals";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import App from "../src/App.js";

const originalFetch = globalThis.fetch;

function installHealthFetch() {
  const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: jest.fn<() => Promise<unknown>>().mockResolvedValue({
      status: "up",
      backend: "up",
      database: "up"
    })
  } as unknown as Response);
  globalThis.fetch = fetchMock;
  return fetchMock;
}

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
  window.sessionStorage.clear();
  window.localStorage.clear();
});

test("composes the authentication shell with backend status", async () => {
  const fetchMock = installHealthFetch();

  render(<App />);

  expect(screen.getByRole("heading", { name: "LF-Chat" })).not.toBeNull();
  expect(screen.getByRole("heading", { name: "Create your account" })).not.toBeNull();
  await waitFor(() => expect(screen.getByText("Backend connected.")).not.toBeNull());
  expect(fetchMock).toHaveBeenCalledWith("http://localhost:3000/health", {
    headers: expect.any(Headers)
  });
});
