import "reflect-metadata";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { useContainer } from "class-validator";
import { AppModule } from "./app.module";
import { parseBackendEnv, type BackendConfig } from "./config/env";
import { loadBackendEnvFile } from "./config/load-env";
import { AppLogger } from "./common/logging/app-logger";

loadBackendEnvFile();

export function configureApp(app: Pick<INestApplication, "enableCors">, config: BackendConfig) {
  app.enableCors({ origin: config.corsOrigins });
}

export function configureValidation(app: Pick<INestApplication, "select" | "useGlobalPipes">) {
  useContainer(app.select(AppModule), { fallbackOnErrors: true });
  app.useGlobalPipes(new ValidationPipe({
    forbidNonWhitelisted: true,
    transform: true,
    whitelist: true
  }));
}

export async function bootstrap() {
  const config = parseBackendEnv();
  const app = await NestFactory.create(AppModule, { logger: new AppLogger() });
  configureApp(app, config);
  configureValidation(app);
  await app.listen(config.port);
}

if (require.main === module) void bootstrap();
