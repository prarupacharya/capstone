import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { IS_PUBLIC_KEY } from "./public.decorator";
import type { AuthenticatedUser } from "./authenticated-request";

interface JwtIdentityPayload {
  sub?: unknown;
  email?: unknown;
  userType?: unknown;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.getBearerToken(request.headers.authorization);
    if (!token) throw new UnauthorizedException();

    try {
      const payload = await this.jwtService.verifyAsync<JwtIdentityPayload>(token);
      const user = this.toAuthenticatedUser(payload);
      if (!user) throw new UnauthorizedException();

      (request as Request & { user: AuthenticatedUser }).user = user;
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }

  private getBearerToken(authorization: string | string[] | undefined) {
    if (typeof authorization !== "string") return null;

    const match = /^Bearer\s+(\S+)$/i.exec(authorization);
    return match?.[1] ?? null;
  }

  private toAuthenticatedUser(payload: JwtIdentityPayload): AuthenticatedUser | null {
    if (
      typeof payload?.sub !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.userType !== "string"
    ) return null;

    return {
      sub: payload.sub,
      email: payload.email,
      userType: payload.userType
    };
  }
}
