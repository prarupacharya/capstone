import { IsEmail, IsNotEmpty, IsString, MinLength } from "class-validator";
import { IsEmailAvailable } from "../validation/is-email-available.decorator";

export class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  @IsEmailAvailable()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password!: string;
}
