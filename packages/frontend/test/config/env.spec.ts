import { describe, expect, test } from "@jest/globals";
import { parseFrontendEnv } from "../../src/config/env.js";

describe("parseFrontendEnv", () => {
  test("uses the local backend URL by default", () => {
    expect(parseFrontendEnv({})).toEqual({ apiBaseUrl: "http://localhost:3000" });
  });

  test("falls back to the default for an empty or whitespace value", () => {
    expect(parseFrontendEnv({ VITE_API_URL: "  " })).toEqual({
      apiBaseUrl: "http://localhost:3000"
    });
  });

  test("trims and normalizes a configured HTTP URL", () => {
    expect(parseFrontendEnv({ VITE_API_URL: "  https://api.example.com/  " })).toEqual({
      apiBaseUrl: "https://api.example.com"
    });
  });

  test("accepts HTTPS URLs without a trailing slash", () => {
    expect(parseFrontendEnv({ VITE_API_URL: "https://api.example.com" })).toEqual({
      apiBaseUrl: "https://api.example.com"
    });
  });

  test("rejects unsupported protocols", () => {
    expect(() => parseFrontendEnv({ VITE_API_URL: "ftp://api.example.com" })).toThrow(
      "VITE_API_URL must use http or https"
    );
  });
});
