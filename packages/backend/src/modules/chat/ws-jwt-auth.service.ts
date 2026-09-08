import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

export interface WsAuthenticatedUser {
  id: string;
  email: string;
  userType: string;
}

interface JwtIdentityPayload {
  sub?: unknown;
  email?: unknown;
  userType?: unknown;
}

@Injectable()
export class WsJwtAuthService {
  constructor(private readonly jwtService: JwtService) {}

  async authenticate(token: unknown): Promise<WsAuthenticatedUser> {
    if (typeof token !== "string" || !token.trim()) {
      throw new Error("Unauthorized");
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtIdentityPayload>(token);
      if (
        typeof payload?.sub !== "string" ||
        typeof payload.email !== "string" ||
        typeof payload.userType !== "string"
      ) throw new Error("Unauthorized");

      return {
        id: payload.sub,
        email: payload.email,
        userType: payload.userType
      };
    } catch {
      throw new Error("Unauthorized");
    }
  }
}
