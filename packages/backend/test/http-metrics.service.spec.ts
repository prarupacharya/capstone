import * as promClient from "prom-client";
import {
  httpErrorsTotal,
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
    metrics.recordRequest("/missing", 404, 4);
    metrics.recordRequest("/unauthorized", 401, 3);
    metrics.recordRequest("/broken", 500, 5);

    return promClient.register.metrics().then((output) => {
      expect(output).toContain('http_requests_total{route="/missing",status_code="404"} 2');
      expect(output).toContain('http_requests_total{route="/broken",status_code="500"} 1');
      expect(output).toContain('http_errors_total{route="/missing",status_code="404"} 2');
      expect(output).toContain('http_errors_total{route="/unauthorized",status_code="401"} 1');
      expect(output).toContain('http_errors_total{route="/broken",status_code="500"} 1');
    });
  });

  it("does not count successful or redirect responses", () => {
    metrics.recordRequest("/health", 200, 5);
    metrics.recordRequest("/created", 201, 5);
    metrics.recordRequest("/redirect", 302, 5);
    metrics.recordRequest("/not-modified", 304, 5);

    return promClient.register.metrics().then((output) => {
      expect(output).not.toContain('http_errors_total{route="/health",status_code="200"}');
      expect(output).not.toContain('http_errors_total{route="/created",status_code="201"}');
      expect(output).not.toContain('http_errors_total{route="/redirect",status_code="302"}');
      expect(output).not.toContain('http_errors_total{route="/not-modified",status_code="304"}');
    });
  });

  it("counts the 4xx and 5xx status boundaries only", () => {
    metrics.recordRequest("/client-boundary", 400, 3);
    metrics.recordRequest("/server-boundary", 599, 5);
    metrics.recordRequest("/below-error-range", 399, 3);
    metrics.recordRequest("/above-error-range", 600, 5);

    return promClient.register.metrics().then((output) => {
      expect(output).toContain('http_errors_total{route="/client-boundary",status_code="400"} 1');
      expect(output).toContain('http_errors_total{route="/server-boundary",status_code="599"} 1');
      expect(output).not.toContain('http_errors_total{route="/below-error-range",status_code="399"}');
      expect(output).not.toContain('http_errors_total{route="/above-error-range",status_code="600"}');
    });
  });

  it("uses the default registry metrics defined by the service", () => {
    expect(promClient.register.getSingleMetric("http_request_duration_seconds")).toBe(httpRequestDuration);
    expect(promClient.register.getSingleMetric("http_requests_total")).toBe(httpRequestsTotal);
    expect(promClient.register.getSingleMetric("http_errors_total")).toBe(httpErrorsTotal);
  });
});
