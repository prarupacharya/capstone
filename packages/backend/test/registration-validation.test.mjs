import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { ValidationPipe } = require("@nestjs/common");
const { plainToInstance } = require("class-transformer");
const { validate } = require("class-validator");
const { RegisterDto } = require("../dist/modules/auth/dto/register.dto.js");
const { IsEmailAvailableConstraint } = require("../dist/modules/auth/validation/is-email-available.validator.js");

test("registration validation rejects invalid email and short passwords", async () => {
  const dto = plainToInstance(RegisterDto, {
    email: "not-an-email",
    password: "short"
  });
  const errors = await validate(dto);

  assert.deepEqual(errors.map((error) => error.property).sort(), ["email", "password"]);
  assert.equal(errors.find((error) => error.property === "email").constraints.isEmail, "email must be an email");
  assert.equal(errors.find((error) => error.property === "password").constraints.minLength, "password must be longer than or equal to 8 characters");

  const pipe = new ValidationPipe({ transform: true, whitelist: true });
  let error;
  try {
    await pipe.transform({ email: "valid@example.com", password: "secret" }, { type: "body", metatype: RegisterDto });
    assert.fail("expected validation to reject the short password");
  } catch (caught) {
    error = caught;
  }
  assert.doesNotMatch(JSON.stringify(error.getResponse()), /secret/);
});

test("registration validation rejects unknown properties without echoing passwords", async () => {
  const pipe = new ValidationPipe({
    forbidNonWhitelisted: true,
    transform: true,
    whitelist: true
  });

  await assert.rejects(
    pipe.transform({
      email: "valid@example.com",
      password: "secret-password",
      role: "admin"
    }, { type: "body", metatype: RegisterDto }),
    (error) => {
      const response = error.getResponse();
      assert.match(JSON.stringify(response), /property role should not exist/);
      assert.doesNotMatch(JSON.stringify(response), /secret-password/);
      return true;
    }
  );
});

test("email availability is checked case-insensitively through the repository", async () => {
  const repository = {
    findByEmail: async (email) => email.trim().toLowerCase() === "alice@example.com" ? { id: "existing-user" } : null
  };
  const constraint = new IsEmailAvailableConstraint(repository);

  assert.equal(await constraint.validate("ALICE@EXAMPLE.COM"), false);
  assert.equal(await constraint.validate("new@example.com"), true);
});
