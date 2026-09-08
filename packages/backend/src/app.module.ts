import { Module } from "@nestjs/common";
import { MiddlewareConsumer } from "@nestjs/common";
import { AppLogger } from "./common/logging/app-logger";
import { RequestLoggingMiddleware } from "./common/logging/request-logging.middleware";
import { DatabaseModule } from "./modules/database/database.module";
import { HealthModule } from "./modules/health/health.module";

@Module({
  imports: [DatabaseModule, HealthModule],
  providers: [AppLogger, RequestLoggingMiddleware]
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggingMiddleware).forRoutes("*");
  }
}
