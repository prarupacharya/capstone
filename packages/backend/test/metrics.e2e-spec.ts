import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { AddressInfo } from "node:net";
import * as promClient from "prom-client";
import { AppModule } from "../src/app.module";

describe("GET /metrics", () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    Object.assign(process.env, {
      DATABASE_ENABLED: "false",
      JWT_SECRET: "metrics-test-secret-that-is-at-least-32-characters",
      JWT_EXPIRES_IN: "15m"
    });
    app = await NestFactory.create(AppModule, { logger: false });
    await app.listen(0);
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });

  beforeEach(() => promClient.register.resetMetrics());
  afterAll(async () => app.close());

  it("returns Prometheus metrics without authentication", async () => {
    await fetch(`${baseUrl}/health`);
    const response = await fetch(`${baseUrl}/metrics`);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(body).toContain("# TYPE http_request_duration_seconds histogram");
    expect(body).toContain("# TYPE http_requests_total counter");
    expect(body).toContain('http_requests_total{route="/health",status_code="200"} 1');
  });

  it("updates labeled metrics after an API error", async () => {
    const response = await fetch(`${baseUrl}/does-not-exist`);
    expect(response.status).toBe(404);

    const metricsResponse = await fetch(`${baseUrl}/metrics`);
    const body = await metricsResponse.text();

    expect(body).toContain('http_requests_total{route="/does-not-exist",status_code="404"} 1');
  });
});
