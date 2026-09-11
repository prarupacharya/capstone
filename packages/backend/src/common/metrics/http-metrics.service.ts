import { Injectable } from "@nestjs/common";
import * as promClient from "prom-client";

export const httpRequestDuration = new promClient.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["route", "status_code"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
});

export const httpRequestsTotal = new promClient.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["route", "status_code"]
});

@Injectable()
export class HttpMetricsService {
  recordRequest(route: string, statusCode: number, durationMs: number) {
    const labels = { route, status_code: String(statusCode) };
    httpRequestDuration.observe(labels, durationMs / 1000);
    httpRequestsTotal.inc(labels);
  }
}
