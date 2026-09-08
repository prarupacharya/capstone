import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { parseJwtConfig } from "../../config/env";
import { UsersModule } from "../users/users.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      useFactory: () => {
        const config = parseJwtConfig();
        return {
          secret: config.secret,
          signOptions: { expiresIn: config.expiresIn }
        };
      }
    }),
    UsersModule
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [JwtModule]
})
export class AuthModule {}
