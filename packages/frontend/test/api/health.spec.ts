import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { fileURLToPath } from "node:url";
import type { HealthResponse } from "../../src/api/health.js";

const requestMock = jest.fn<
  (path: string, init?: RequestInit, options?: { authenticated?: boolean }) => Promise<Response>
>();

jest.unstable_mockModule(fileURLToPath(new URL("../../src/api/client.ts", import.meta.url)), () => ({
  request: requestMock
}));

const { getHealth } = await import("../../src/api/health.js");

const healthyResponse: HealthResponse = {
  status: "up",
  backend: "up",
  database: "up"
};

describe("getHealth", () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  test("requests the health endpoint and returns its payload", async () => {
    const response = {
      json: jest.fn<() => Promise<unknown>>()
    } as unknown as Response;
    response.json = jest.fn<() => Promise<unknown>>().mockResolvedValue(healthyResponse);
    requestMock.mockResolvedValue(response);

    const result = await getHealth();

    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(requestMock).toHaveBeenCalledWith("/health");
    expect(response.json).toHaveBeenCalledTimes(1);
    expect(result).toEqual(healthyResponse);
  });
});
