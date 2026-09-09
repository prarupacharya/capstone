import bcrypt from "bcrypt";
import type { JwtService } from "@nestjs/jwt";
import { AuthService } from "../src/modules/auth/auth.service";
import type { UsersRepository } from "../src/modules/users/users.repository";

jest.mock("bcrypt", () => ({
  __esModule: true,
  default: {
    hash: jest.fn(),
    hashSync: jest.fn().mockReturnValue("dummy-hash")
  }
}));

const hashMock = bcrypt.hash as jest.Mock;
const createUserMock = jest.fn();
const user = {
  id: "user-123",
  email: "new@example.com",
  username: null,
  hashedPassword: "hashed-password",
  createdDateTime: new Date("2026-01-01T00:00:00.000Z"),
  userType: "generaluser"
};

function createService() {
  return new AuthService(
    { createUser: createUserMock } as unknown as UsersRepository,
    {} as JwtService
  );
}

describe("AuthService.register", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    hashMock.mockResolvedValue("hashed-password");
  });

  it("normalizes input, hashes the password, and returns a public user", async () => {
    createUserMock.mockResolvedValue(user);

    const result = await createService().register({
      email: "  NEW@Example.COM ",
      password: "correct-password"
    });

    expect(hashMock).toHaveBeenCalledWith("correct-password", 12);
    expect(createUserMock).toHaveBeenCalledWith({
      email: "new@example.com",
      hashedPassword: "hashed-password"
    });
    expect(result).toEqual({
      id: user.id,
      email: user.email,
      username: user.username,
      createdDateTime: user.createdDateTime,
      userType: user.userType
    });
    expect(result).not.toHaveProperty("hashedPassword");
  });

  it("maps recognized duplicate-email errors to conflict", async () => {
    for (const error of [
      { code: "23505" },
      { code: "23505", constraint: "users_email_unique" }
    ]) {
      createUserMock.mockRejectedValue(error);

      await expect(createService().register({ email: "user@example.com", password: "password" }))
        .rejects.toMatchObject({ status: 409, message: "email is already registered" });
    }
  });

  it("propagates unrelated database errors", async () => {
    for (const error of [
      new Error("database unavailable"),
      { code: "23505", constraint: "other_unique_index" },
      null
    ]) {
      createUserMock.mockRejectedValue(error);

      await expect(createService().register({ email: "user@example.com", password: "password" }))
        .rejects.toBe(error);
    }
  });
});
