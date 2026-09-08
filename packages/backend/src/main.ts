import "reflect-metadata";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { parseBackendEnv, type BackendConfig } from "./config/env";

const envPath = resolve(__dirname, "../.env");
if (existsSync(envPath)) process.loadEnvFile(envPath);

export function configureApp(app: Pick<INestApplication, "enableCors">, config: BackendConfig) {
  app.enableCors({ origin: config.corsOrigins });
}

export async function bootstrap() {
  const config = parseBackendEnv();
  const app = await NestFactory.create(AppModule);
  configureApp(app, config);
  await app.listen(config.port);
}

if (require.main === module) void bootstrap();
