import type { JwtService } from "@nestjs/jwt";
import { WsJwtAuthService } from "../src/modules/chat/ws-jwt-auth.service";

function createService() {
  const jwtService = { verifyAsync: jest.fn() };
  const service = new WsJwtAuthService(jwtService as unknown as JwtService);

  return { jwtService, service };
}

describe("WsJwtAuthService", () => {
  it("returns only the authenticated identity for a valid token", async () => {
    const { jwtService, service } = createService();
    jwtService.verifyAsync.mockResolvedValue({
      sub: "user-123",
      email: "user@example.com",
      userType: "generaluser",
      password: "should-not-be-exposed"
    });

    await expect(service.authenticate("valid-token")).resolves.toEqual({
      id: "user-123",
      email: "user@example.com",
      userType: "generaluser"
    });
    expect(jwtService.verifyAsync).toHaveBeenCalledWith("valid-token");
  });

  it("rejects missing, blank, and non-string tokens", async () => {
    const { jwtService, service } = createService();

    for (const token of [undefined, " ", 123, null]) {
      await expect(service.authenticate(token)).rejects.toThrow("Unauthorized");
    }

    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it("rejects malformed payloads and verification failures", async () => {
    const { jwtService, service } = createService();
    const malformedPayloads = [
      {},
      { sub: 123, email: "user@example.com", userType: "generaluser" },
      { sub: "user-123", email: null, userType: "generaluser" },
      { sub: "user-123", email: "user@example.com", userType: false }
    ];

    for (const payload of malformedPayloads) {
      jwtService.verifyAsync.mockResolvedValue(payload);
      await expect(service.authenticate("token")).rejects.toThrow("Unauthorized");
    }

    jwtService.verifyAsync.mockRejectedValue(new Error("invalid token details"));
    await expect(service.authenticate("token")).rejects.toThrow("Unauthorized");
  });
});
