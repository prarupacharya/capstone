import { Module } from "@nestjs/common";
import { MiddlewareConsumer } from "@nestjs/common";
import { AppLogger } from "./common/logging/app-logger";
import { RequestLoggingMiddleware } from "./common/logging/request-logging.middleware";
import { IsEmailAvailableConstraint } from "./modules/auth/validation/is-email-available.validator";
import { DatabaseModule } from "./modules/database/database.module";
import { HealthModule } from "./modules/health/health.module";
import { UsersModule } from "./modules/users/users.module";

@Module({
  imports: [DatabaseModule, HealthModule, UsersModule],
  providers: [AppLogger, IsEmailAvailableConstraint, RequestLoggingMiddleware]
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggingMiddleware).forRoutes("*");
  }
}
