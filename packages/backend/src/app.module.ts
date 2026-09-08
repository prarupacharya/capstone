import { MiddlewareConsumer, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtAuthGuard } from "./common/auth/jwt-auth.guard";
import { AppLogger } from "./common/logging/app-logger";
import { RequestLoggingMiddleware } from "./common/logging/request-logging.middleware";
import { AuthModule } from "./modules/auth/auth.module";
import { IsEmailAvailableConstraint } from "./modules/auth/validation/is-email-available.validator";
import { DatabaseModule } from "./modules/database/database.module";
import { ChatModule } from "./modules/chat/chat.module";
import { HealthModule } from "./modules/health/health.module";
import { UsersModule } from "./modules/users/users.module";

@Module({
  imports: [AuthModule, ChatModule, DatabaseModule, HealthModule, UsersModule],
  providers: [
    AppLogger,
    IsEmailAvailableConstraint,
    RequestLoggingMiddleware,
    { provide: APP_GUARD, useClass: JwtAuthGuard }
  ]
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggingMiddleware).forRoutes("*");
  }
}
