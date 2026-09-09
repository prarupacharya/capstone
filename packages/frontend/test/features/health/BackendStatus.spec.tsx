import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { fileURLToPath } from "node:url";
import type { HealthResponse } from "../../../src/api/health.js";

const getHealthMock = jest.fn<() => Promise<HealthResponse>>();

jest.unstable_mockModule(
  fileURLToPath(new URL("../../../src/api/health.ts", import.meta.url)),
  () => ({ getHealth: getHealthMock })
);

const { BackendStatus } = await import("../../../src/features/health/BackendStatus.tsx");

const healthyResponse: HealthResponse = {
  status: "up",
  backend: "up",
  database: "up"
};

afterEach(() => {
  cleanup();
});

describe("BackendStatus", () => {
  beforeEach(() => {
    getHealthMock.mockReset();
  });

  test("shows a checking state while health is pending", () => {
    getHealthMock.mockReturnValue(new Promise<HealthResponse>(() => undefined));

    render(<BackendStatus />);

    expect(screen.getByText("Checking backend...")).not.toBeNull();
  });

  test("shows connected only when backend and database are up", async () => {
    getHealthMock.mockResolvedValue(healthyResponse);

    render(<BackendStatus />);

    await waitFor(() => expect(screen.getByText("Backend connected.")).not.toBeNull());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("shows unavailable when any health dependency is down", async () => {
    getHealthMock.mockResolvedValue({ ...healthyResponse, database: "down" });

    render(<BackendStatus />);

    await waitFor(() => expect(screen.getByRole("alert")).not.toBeNull());
    expect(screen.getByRole("alert").textContent).toBe("Backend unavailable.");
  });

  test("shows unavailable when health cannot be requested", async () => {
    getHealthMock.mockRejectedValue(new Error("backend offline"));

    render(<BackendStatus />);

    await waitFor(() => expect(screen.getByRole("alert")).not.toBeNull());
    expect(screen.getByRole("alert").textContent).toBe("Backend unavailable.");
  });

  test("does not update after unmounting before health resolves", async () => {
    let resolveHealth: (health: HealthResponse) => void = () => undefined;
    const pendingHealth = new Promise<HealthResponse>((resolve) => { resolveHealth = resolve; });
    getHealthMock.mockReturnValue(pendingHealth);
    const { unmount } = render(<BackendStatus />);

    unmount();
    resolveHealth(healthyResponse);
    await pendingHealth;
    await Promise.resolve();

    expect(getHealthMock).toHaveBeenCalledTimes(1);
  });
});
