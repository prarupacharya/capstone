import { UnauthorizedException } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import type { JwtService } from "@nestjs/jwt";
import type { ExecutionContext } from "@nestjs/common";
import { JwtAuthGuard } from "../src/common/auth/jwt-auth.guard";

function createContext(authorization?: string | string[]) {
  const request = { headers: { authorization } };
  const context = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => request })
  } as unknown as ExecutionContext;

  return { context, request };
}

function createGuard() {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
  const jwtService = { verifyAsync: jest.fn() };
  const guard = new JwtAuthGuard(
    reflector as unknown as Reflector,
    jwtService as unknown as JwtService
  );

  return { guard, reflector, jwtService };
}

describe("JwtAuthGuard", () => {
  it("allows public routes without verifying a token", async () => {
    const { guard, reflector, jwtService } = createGuard();
    reflector.getAllAndOverride.mockReturnValue(true);

    await expect(guard.canActivate(createContext().context)).resolves.toBe(true);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it("rejects missing and malformed bearer headers", async () => {
    const { guard } = createGuard();

    for (const authorization of [undefined, [], "Token token", "Bearer"]) {
      await expect(guard.canActivate(createContext(authorization).context))
        .rejects.toBeInstanceOf(UnauthorizedException);
    }
  });

  it("attaches only the validated public identity for a valid token", async () => {
    const { guard, jwtService } = createGuard();
    jwtService.verifyAsync.mockResolvedValue({
      sub: "user-123",
      email: "user@example.com",
      userType: "generaluser",
      password: "must-not-escape"
    });
    const { context, request } = createContext("Bearer valid-token");

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(jwtService.verifyAsync).toHaveBeenCalledWith("valid-token");
    expect(request).toHaveProperty("user", {
      sub: "user-123",
      email: "user@example.com",
      userType: "generaluser"
    });
  });

  it("rejects invalid identity payloads and verification failures", async () => {
    const { guard, jwtService } = createGuard();
    const invalidPayloads = [
      {},
      { sub: 123, email: "user@example.com", userType: "generaluser" },
      { sub: "user-123", email: null, userType: "generaluser" },
      { sub: "user-123", email: "user@example.com", userType: false }
    ];

    for (const payload of invalidPayloads) {
      jwtService.verifyAsync.mockResolvedValue(payload);
      await expect(guard.canActivate(createContext("Bearer token").context))
        .rejects.toBeInstanceOf(UnauthorizedException);
    }

    jwtService.verifyAsync.mockRejectedValue(new Error("expired token"));
    await expect(guard.canActivate(createContext("Bearer expired").context))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });
});
