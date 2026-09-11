import type { NextFunction, Request, Response } from "express";
import { AppLogger } from "../src/common/logging/app-logger";
import { getCorrelationId } from "../src/common/logging/correlation-context";
import { RequestLoggingMiddleware } from "../src/common/logging/request-logging.middleware";

function createMiddleware(
  statusCode: number,
  header?: string,
  originalUrl?: string,
  nextImplementation: () => void = () => undefined
) {
  const logger = { writeToFile: jest.fn() };
  const events: Record<string, () => void> = {};
  const response = {
    statusCode,
    setHeader: jest.fn(),
    once: jest.fn((event: string, callback: () => void) => { events[event] = callback; })
  } as unknown as Response;
  const request = {
    method: "GET",
    originalUrl,
    url: "/fallback",
    get: jest.fn(() => header)
  } as unknown as Request;
  const next = jest.fn(nextImplementation) as unknown as NextFunction;
  const middleware = new RequestLoggingMiddleware(logger as unknown as AppLogger);
  middleware.use(request, response, next);
  return { events, logger, next, response };
}

describe("RequestLoggingMiddleware", () => {
  it("reuses safe IDs and logs finish only once at INFO", () => {
    const { events, logger, next, response } = createMiddleware(200, "request-123", "/health");
    events.finish();
    events.close();

    expect(response.setHeader).toHaveBeenCalledWith("X-Correlation-ID", "request-123");
    expect(next).toHaveBeenCalledTimes(1);
    expect(logger.writeToFile).toHaveBeenCalledTimes(1);
    expect(logger.writeToFile).toHaveBeenCalledWith("GET", "INFO", "API request completed", expect.objectContaining({ path: "/health", statusCode: 200, correlationId: "request-123" }));
  });

  it("propagates the request ID to downstream work", () => {
    let downstreamCorrelationId: string | undefined;
    createMiddleware(200, "request-123", "/health", () => {
      downstreamCorrelationId = getCorrelationId();
    });

    expect(downstreamCorrelationId).toBe("request-123");
  });

  it.each([[400, "WARN"], [500, "ERROR"]] as const)("maps %i responses to %s", (statusCode, level) => {
    const { events, logger, response } = createMiddleware(statusCode, "unsafe/id");
    events.close();

    const generatedId = (response.setHeader as jest.Mock).mock.calls[0][1];
    expect(generatedId).toMatch(/^[a-f0-9-]{36}$/);
    expect(logger.writeToFile).toHaveBeenCalledWith("GET", level, "API request completed", expect.objectContaining({ path: "/fallback", statusCode }));
  });
});
