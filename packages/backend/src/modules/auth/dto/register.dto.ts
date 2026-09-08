import { Transform } from "class-transformer";
import { IsEmail, IsNotEmpty, IsString, MinLength } from "class-validator";
import { IsEmailAvailable } from "../validation/is-email-available.decorator";

export class RegisterDto {
  @Transform(({ value }) => typeof value === "string" ? value.trim() : value)
  @IsEmail()
  @IsNotEmpty()
  @IsEmailAvailable()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password!: string;
}
