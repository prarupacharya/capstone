import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";
import { toPublicUserResponse, type LoginResponse, type PublicUserResponse } from "./auth.responses";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { UsersRepository } from "../users/users.repository";

const PASSWORD_HASH_ROUNDS = 12;
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(
  randomBytes(32).toString("hex"),
  PASSWORD_HASH_ROUNDS
);

function isDuplicateEmailError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const databaseError = error as { code?: unknown; constraint?: unknown };
  return databaseError.code === "23505" &&
    (!databaseError.constraint || databaseError.constraint === "users_email_unique");
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly jwtService: JwtService
  ) {}

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

  async login(input: LoginDto): Promise<LoginResponse> {
    const email = input.email.trim().toLowerCase();
    const user = await this.usersRepository.findByEmail(email);
    const passwordHash = user?.hashedPassword ?? DUMMY_PASSWORD_HASH;
    const passwordMatches = await bcrypt.compare(input.password, passwordHash);

    if (!user || !passwordMatches) {
      throw new UnauthorizedException("invalid email or password");
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      userType: user.userType
    });

    return { accessToken };
  }
}
