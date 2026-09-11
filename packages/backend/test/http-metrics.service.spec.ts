import * as promClient from "prom-client";
import {
  httpRequestDuration,
  httpRequestsTotal,
  HttpMetricsService
} from "../src/common/metrics/http-metrics.service";

describe("HttpMetricsService", () => {
  const metrics = new HttpMetricsService();

  beforeEach(() => promClient.register.resetMetrics());

  it("aggregates request totals and duration observations", () => {
    metrics.recordRequest("/health", 200, 12);

    return promClient.register.metrics().then((output) => {
      expect(output).toContain('http_requests_total{route="/health",status_code="200"} 1');
      expect(output).toContain('http_request_duration_seconds_sum{route="/health",status_code="200"} 0.012');
    });
  });

  it("counts client and server errors", () => {
    metrics.recordRequest("/missing", 404, 3);
    metrics.recordRequest("/broken", 500, 5);

    return promClient.register.metrics().then((output) => {
      expect(output).toContain('http_requests_total{route="/missing",status_code="404"} 1');
      expect(output).toContain('http_requests_total{route="/broken",status_code="500"} 1');
    });
  });

  it("uses the default registry metrics defined by the service", () => {
    expect(promClient.register.getSingleMetric("http_request_duration_seconds")).toBe(httpRequestDuration);
    expect(promClient.register.getSingleMetric("http_requests_total")).toBe(httpRequestsTotal);
  });
});
