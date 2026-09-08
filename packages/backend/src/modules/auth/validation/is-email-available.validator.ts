import { Injectable } from "@nestjs/common";
import { ValidatorConstraint, type ValidationArguments, type ValidatorConstraintInterface } from "class-validator";
import { UsersRepository } from "../../users/users.repository";

@Injectable()
@ValidatorConstraint({ name: "isEmailAvailable", async: true })
export class IsEmailAvailableConstraint implements ValidatorConstraintInterface {
  constructor(private readonly usersRepository?: UsersRepository) {}

  async validate(value: unknown, _args: ValidationArguments) {
    if (typeof value !== "string" || !value.trim() || !this.usersRepository) return true;

    return (await this.usersRepository.findByEmail(value)) === null;
  }

  defaultMessage() {
    return "email is already registered";
  }
}
