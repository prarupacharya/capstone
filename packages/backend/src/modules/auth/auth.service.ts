import { ConflictException, Injectable } from "@nestjs/common";
import bcrypt from "bcrypt";
import { RegisterDto } from "./dto/register.dto";
import { toPublicUserResponse, type PublicUserResponse } from "./auth.responses";
import { UsersRepository } from "../users/users.repository";

const PASSWORD_HASH_ROUNDS = 12;

function isDuplicateEmailError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const databaseError = error as { code?: unknown; constraint?: unknown };
  return databaseError.code === "23505" &&
    (!databaseError.constraint || databaseError.constraint === "users_email_unique");
}

@Injectable()
export class AuthService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async register(input: RegisterDto): Promise<PublicUserResponse> {
    const email = input.email.trim().toLowerCase();
    const hashedPassword = await bcrypt.hash(input.password, PASSWORD_HASH_ROUNDS);

    try {
      const user = await this.usersRepository.createUser({ email, hashedPassword });
      return toPublicUserResponse(user);
    } catch (error) {
      if (isDuplicateEmailError(error)) {
        throw new ConflictException("email is already registered");
      }

      throw error;
    }
  }
}
