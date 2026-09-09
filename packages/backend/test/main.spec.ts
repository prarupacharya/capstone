import type { INestApplication } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app.module";
import { AppLogger } from "../src/common/logging/app-logger";
import { bootstrap, configureApp, configureValidation } from "../src/main";

describe("main application configuration", () => {
  afterEach(() => jest.restoreAllMocks());

  it("configures CORS from the parsed backend settings", () => {
    const app = { enableCors: jest.fn() };

    configureApp(app, { port: 3000, corsOrigins: ["https://example.com"] });

    expect(app.enableCors).toHaveBeenCalledWith({ origin: ["https://example.com"] });
  });

  it("configures the validation container and global pipe", () => {
    const selected = {};
    const app = {
      select: jest.fn().mockReturnValue(selected),
      useGlobalPipes: jest.fn()
    };
    configureValidation(app);

    expect(app.select).toHaveBeenCalledWith(AppModule);
    expect(app.useGlobalPipes).toHaveBeenCalledWith(expect.any(ValidationPipe));
  });

  it("creates, configures, and listens on the parsed port", async () => {
    const previous = {
      CORS_ORIGINS: process.env.CORS_ORIGINS,
      PORT: process.env.PORT
    };
    process.env.CORS_ORIGINS = "https://example.com";
    process.env.PORT = "4321";
    const app = {
      enableCors: jest.fn(),
      select: jest.fn().mockReturnValue({}),
      useGlobalPipes: jest.fn(),
      listen: jest.fn().mockResolvedValue(undefined)
    } as unknown as INestApplication;
    const create = jest.spyOn(NestFactory, "create").mockResolvedValue(app);

    try {
      await bootstrap();
    } finally {
      if (previous.CORS_ORIGINS === undefined) delete process.env.CORS_ORIGINS;
      else process.env.CORS_ORIGINS = previous.CORS_ORIGINS;
      if (previous.PORT === undefined) delete process.env.PORT;
      else process.env.PORT = previous.PORT;
    }

    expect(create).toHaveBeenCalledWith(AppModule, { logger: expect.any(AppLogger) });
    expect(app.enableCors).toHaveBeenCalledWith({ origin: ["https://example.com"] });
    expect(app.useGlobalPipes).toHaveBeenCalledWith(expect.any(ValidationPipe));
    expect(app.listen).toHaveBeenCalledWith(4321);
  });
});
