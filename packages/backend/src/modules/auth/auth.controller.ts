import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "../../common/auth/authenticated-request";
import { Public } from "../../common/auth/public.decorator";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @Public()
  register(@Body() input: RegisterDto) {
    return this.authService.register(input);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @Public()
  login(@Body() input: LoginDto) {
    return this.authService.login(input);
  }

  @Get("me")
  me(@Req() request: AuthenticatedRequest) {
    return {
      id: request.user.sub,
      email: request.user.email,
      userType: request.user.userType
    };
  }
}
