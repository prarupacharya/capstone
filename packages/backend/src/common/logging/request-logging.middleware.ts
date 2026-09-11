import { randomUUID } from "node:crypto";
import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { AppLogger } from "./app-logger";
import { runWithCorrelationId } from "./correlation-context";

const correlationIdHeader = "X-Correlation-ID";

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  constructor(private readonly logger: AppLogger) {}

  use(request: Request, response: Response, next: NextFunction) {
    const startedAt = Date.now();
    const correlationId = this.getCorrelationId(request);
    let logged = false;

    response.setHeader(correlationIdHeader, correlationId);

    const logRequest = () => {
      if (logged) return;
      logged = true;

      const statusCode = response.statusCode;
      const level = statusCode >= 500 ? "ERROR" : statusCode >= 400 ? "WARN" : "INFO";
      const requestPath = request.originalUrl ?? request.url;

      this.logger.writeToFile(request.method, level, "API request completed", {
        method: request.method,
        path: requestPath,
        statusCode,
        durationMs: Date.now() - startedAt,
        correlationId
      });
    };

    return runWithCorrelationId(correlationId, () => {
      response.once("finish", logRequest);
      response.once("close", logRequest);
      next();
    });
  }

  private getCorrelationId(request: Request) {
    const requestedId = request.get(correlationIdHeader);

    // Only reuse safe, bounded IDs supplied by callers; otherwise create one.
    if (requestedId && /^[a-zA-Z0-9._:-]{1,128}$/.test(requestedId)) {
      return requestedId;
    }

    return randomUUID();
  }
}
