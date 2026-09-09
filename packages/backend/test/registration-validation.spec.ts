import { ValidationPipe } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate, type ValidationArguments } from "class-validator";
import { RegisterDto } from "../src/modules/auth/dto/register.dto";
import { IsEmailAvailableConstraint } from "../src/modules/auth/validation/is-email-available.validator";
import type { UsersRepository } from "../src/modules/users/users.repository";

describe("registration validation", () => {
  it("rejects invalid email and short passwords without echoing secrets", async () => {
    const dto = plainToInstance(RegisterDto, { email: "not-an-email", password: "short" });
    const errors = await validate(dto);

    expect(errors.map((error) => error.property).sort()).toEqual(["email", "password"]);
    expect(errors.find((error) => error.property === "email")?.constraints?.isEmail)
      .toBe("email must be an email");
    expect(errors.find((error) => error.property === "password")?.constraints?.minLength)
      .toBe("password must be longer than or equal to 8 characters");

    const pipe = new ValidationPipe({ transform: true, whitelist: true });
    const error: unknown = await pipe.transform(
      { email: "valid@example.com", password: "secret" },
      { type: "body", metatype: RegisterDto }
    ).catch((caught: unknown) => caught);

    expect(JSON.stringify((error as { getResponse: () => unknown }).getResponse())).not.toContain("secret");
  });

  it("rejects unknown properties without echoing passwords", async () => {
    const pipe = new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true
    });
    const error: unknown = await pipe.transform(
      { email: "valid@example.com", password: "secret-password", role: "admin" },
      { type: "body", metatype: RegisterDto }
    ).catch((caught: unknown) => caught);
    const response = (error as { getResponse: () => unknown }).getResponse();

    expect(JSON.stringify(response)).toContain("property role should not exist");
    expect(JSON.stringify(response)).not.toContain("secret-password");
  });

  it("checks email availability through the repository", async () => {
    const repository = {
      findByEmail: jest.fn()
        .mockResolvedValueOnce({ id: "existing-user" })
        .mockResolvedValueOnce(null)
    };
    const constraint = new IsEmailAvailableConstraint(repository as unknown as UsersRepository);
    const args = {} as ValidationArguments;

    expect(await constraint.validate("ALICE@EXAMPLE.COM", args)).toBe(false);
    expect(await constraint.validate("new@example.com", args)).toBe(true);
    expect(repository.findByEmail).toHaveBeenNthCalledWith(1, "ALICE@EXAMPLE.COM");
    expect(constraint.defaultMessage()).toBe("email is already registered");
  });

  it("allows blank or unsupported values without a repository", async () => {
    const constraint = new IsEmailAvailableConstraint();
    const args = {} as ValidationArguments;

    expect(await constraint.validate(undefined, args)).toBe(true);
    expect(await constraint.validate(" ", args)).toBe(true);
    expect(await constraint.validate(123, args)).toBe(true);
  });
});
