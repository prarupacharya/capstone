import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import type { CreateUserInput, User } from "./user.types";

interface UserRow {
  id: string;
  email: string;
  username: string | null;
  hashed_password: string;
  createddatetime: Date;
  usertype: string;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    hashedPassword: row.hashed_password,
    createdDateTime: row.createddatetime,
    userType: row.usertype
  };
}

@Injectable()
export class UsersRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async createUser(input: CreateUserInput): Promise<User> {
    const result = await this.databaseService.getPool().query<UserRow>(
      `
        INSERT INTO users (email, hashed_password)
        VALUES ($1, $2)
        RETURNING id, email, username, hashed_password, createddatetime, usertype
      `,
      [normalizeEmail(input.email), input.hashedPassword]
    );

    return mapUser(result.rows[0]);
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.databaseService.getPool().query<UserRow>(
      `
        SELECT id, email, username, hashed_password, createddatetime, usertype
        FROM users
        WHERE LOWER(email) = $1
        LIMIT 1
      `,
      [normalizeEmail(email)]
    );

    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }
}
