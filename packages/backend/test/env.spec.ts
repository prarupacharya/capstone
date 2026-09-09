import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "../src/app.module";
import { configureApp, configureValidation } from "../src/main";
import { parseBackendEnv, parseJwtConfig } from "../src/config/env";

describe("backend environment configuration", () => {
  it("uses safe backend environment defaults", () => {
    expect(parseBackendEnv({})).toEqual({
      port: 3000,
      corsOrigins: ["http://localhost:5173"]
    });
  });

  it("parses backend port and CORS overrides", () => {
    expect(parseBackendEnv({
      PORT: "4000",
      CORS_ORIGINS: "http://localhost:5173,https://app.example.com"
    })).toEqual({
      port: 4000,
      corsOrigins: ["http://localhost:5173", "https://app.example.com"]
    });
  });

  it("rejects invalid backend environment values", () => {
    expect(() => parseBackendEnv({ PORT: "70000" })).toThrow(/PORT/);
    expect(() => parseBackendEnv({ CORS_ORIGINS: "*" })).toThrow(/wildcard/);
  });

  it("wires configured origins into Nest CORS", () => {
    const app = { enableCors: jest.fn() };
    configureApp(app, parseBackendEnv({
      CORS_ORIGINS: "http://localhost:5173,https://app.example.com"
    }));

    expect(app.enableCors).toHaveBeenCalledWith({
      origin: ["http://localhost:5173", "https://app.example.com"]
    });
  });

  it("configures a global validation pipe", () => {
    const app = {
      select: jest.fn().mockReturnValue({}),
      useGlobalPipes: jest.fn()
    };

    configureValidation(app);

    expect(app.select).toHaveBeenCalledWith(AppModule);
    expect(app.useGlobalPipes).toHaveBeenCalledWith(expect.any(ValidationPipe));
  });

  it("parses JWT configuration with a safe default expiration", () => {
    expect(parseJwtConfig({
      JWT_SECRET: "a-secret-that-is-at-least-32-characters-long"
    })).toEqual({
      secret: "a-secret-that-is-at-least-32-characters-long",
      expiresIn: "15m"
    });
    expect(parseJwtConfig({
      JWT_SECRET: "a-secret-that-is-at-least-32-characters-long",
      JWT_EXPIRES_IN: "2h"
    }).expiresIn).toBe("2h");
  });

  it("rejects missing, short, and invalid JWT configuration", () => {
    expect(() => parseJwtConfig({})).toThrow(/JWT_SECRET/);
    expect(() => parseJwtConfig({ JWT_SECRET: "too-short" })).toThrow(/JWT_SECRET/);
    expect(() => parseJwtConfig({
      JWT_SECRET: "a-secret-that-is-at-least-32-characters-long",
      JWT_EXPIRES_IN: "forever"
    })).toThrow(/JWT_EXPIRES_IN/);
  });
});
