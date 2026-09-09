import bcrypt from "bcrypt";
import type { JwtService } from "@nestjs/jwt";
import { AuthService } from "../src/modules/auth/auth.service";
import type { UsersRepository } from "../src/modules/users/users.repository";

jest.mock("bcrypt", () => ({
  __esModule: true,
  default: {
    hash: jest.fn(),
    hashSync: jest.fn().mockReturnValue("dummy-password-hash"),
    compare: jest.fn()
  }
}));

const compareMock = bcrypt.compare as jest.Mock;
const findByEmailMock = jest.fn();
const signAsyncMock = jest.fn();
const user = {
  id: "user-123",
  email: "login@example.com",
  username: null,
  hashedPassword: "stored-password-hash",
  createdDateTime: new Date("2026-01-01T00:00:00.000Z"),
  userType: "generaluser"
};

function createService() {
  return new AuthService(
    { findByEmail: findByEmailMock } as unknown as UsersRepository,
    { signAsync: signAsyncMock } as unknown as JwtService
  );
}

describe("AuthService.login", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    compareMock.mockResolvedValue(true);
    signAsyncMock.mockResolvedValue("signed-token");
  });

  it("normalizes the email and signs minimal identity claims", async () => {
    findByEmailMock.mockResolvedValue(user);

    await expect(createService().login({
      email: "  LOGIN@EXAMPLE.COM ",
      password: "correct-password"
    })).resolves.toEqual({ accessToken: "signed-token" });

    expect(findByEmailMock).toHaveBeenCalledWith("login@example.com");
    expect(compareMock).toHaveBeenCalledWith("correct-password", user.hashedPassword);
    expect(signAsyncMock).toHaveBeenCalledWith({
      sub: user.id,
      email: user.email,
      userType: user.userType
    });
  });

  it("rejects a wrong password without signing a token", async () => {
    findByEmailMock.mockResolvedValue(user);
    compareMock.mockResolvedValue(false);

    await expect(createService().login({ email: user.email, password: "wrong-password" }))
      .rejects.toMatchObject({ status: 401, message: "invalid email or password" });
    expect(signAsyncMock).not.toHaveBeenCalled();
  });

  it("uses a dummy hash and the same unauthorized response for an unknown user", async () => {
    findByEmailMock.mockResolvedValue(null);

    await expect(createService().login({ email: "missing@example.com", password: "password" }))
      .rejects.toMatchObject({ status: 401, message: "invalid email or password" });
    expect(compareMock).toHaveBeenCalledWith("password", "dummy-password-hash");
    expect(signAsyncMock).not.toHaveBeenCalled();
  });
});
