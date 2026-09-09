import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { AddressInfo } from "node:net";
import { AppModule } from "../src/app.module";

describe("request logging", () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    Object.assign(process.env, { DATABASE_ENABLED: "false", JWT_SECRET: "logging-test-secret-that-is-at-least-32-characters", JWT_EXPIRES_IN: "15m" });
    app = await NestFactory.create(AppModule, { logger: false });
    await app.listen(0);
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });

  afterAll(async () => app.close());

  it("logs a non-GET request and preserves its safe correlation ID", async () => {
    const lines: string[] = [];
    const log = console.log;
    console.log = (...args: unknown[]) => lines.push(args.join(" "));
    try {
      const response = await fetch(`${baseUrl}/health`, {
        method: "POST",
        headers: { "X-Correlation-ID": "request-from-test" }
      });
      expect(response.status).toBe(404);
      expect(response.headers.get("x-correlation-id")).toBe("request-from-test");
    } finally {
      console.log = log;
    }
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/\[WARN\] - API request completed/);
    expect(lines[0]).toContain('"correlationId":"request-from-test"');
  });
});
