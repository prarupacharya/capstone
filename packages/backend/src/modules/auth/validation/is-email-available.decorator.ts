import { registerDecorator, type ValidationOptions } from "class-validator";
import { IsEmailAvailableConstraint } from "./is-email-available.validator";

export function IsEmailAvailable(validationOptions?: ValidationOptions): PropertyDecorator {
  return (object, propertyName) => {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName as string,
      options: validationOptions,
      validator: IsEmailAvailableConstraint
    });
  };
}
