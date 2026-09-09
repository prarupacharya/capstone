import { Pool } from "pg";
import { DatabaseService } from "../src/modules/database/database.service";
import { runUsersMigration } from "../src/modules/database/migrations/001-create-users";
import { UsersRepository } from "../src/modules/users/users.repository";

const row = {
  id: "user-123",
  email: "alice@example.com",
  username: null,
  hashed_password: "bcrypt-hash",
  createddatetime: new Date("2026-01-01T00:00:00.000Z"),
  usertype: "generaluser"
};
const user = {
  id: row.id,
  email: row.email,
  username: row.username,
  hashedPassword: row.hashed_password,
  createdDateTime: row.createddatetime,
  userType: row.usertype
};

describe("UsersRepository", () => {
  it("normalizes emails and maps created and found users", async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [row] })
      .mockResolvedValueOnce({ rows: [row] })
      .mockResolvedValueOnce({ rows: [] });
    const pool = { query };
    const repository = new UsersRepository({
      getPool: () => pool
    } as unknown as DatabaseService);

    expect(await repository.createUser({
      email: "  Alice@Example.COM ",
      hashedPassword: "bcrypt-hash"
    })).toEqual(user);
    expect(await repository.findByEmail("ALICE@example.com")).toEqual(user);
    expect(await repository.findByEmail("missing@example.com")).toBeNull();

    expect(query).toHaveBeenNthCalledWith(1, expect.stringContaining("INSERT INTO users"), [
      "alice@example.com",
      "bcrypt-hash"
    ]);
    expect(query).toHaveBeenNthCalledWith(2, expect.stringContaining("LOWER(email) = $1"), [
      "alice@example.com"
    ]);
    expect(query).toHaveBeenNthCalledWith(3, expect.stringContaining("LOWER(email) = $1"), [
      "missing@example.com"
    ]);
  });

  it("propagates database errors", async () => {
    const failure = new Error("duplicate key");
    const repository = new UsersRepository({
      getPool: () => ({ query: jest.fn().mockRejectedValue(failure) })
    } as unknown as DatabaseService);

    await expect(repository.createUser({ email: "a@example.com", hashedPassword: "hash" }))
      .rejects.toBe(failure);
  });

  const postgresTest = process.env.TEST_DATABASE_URL ? it : it.skip;
  postgresTest("persists users with normalized email and uniqueness", async () => {
    const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    const repository = new UsersRepository({ getPool: () => pool } as unknown as DatabaseService);

    try {
      await runUsersMigration(pool, "down");
      await runUsersMigration(pool);
      const created = await repository.createUser({ email: "  Alice@Example.COM ", hashedPassword: "bcrypt-hash" });

      expect(created.email).toBe("alice@example.com");
      expect(created.username).toBeNull();
      expect(created.hashedPassword).toBe("bcrypt-hash");
      expect(await repository.findByEmail("ALICE@example.com")).toEqual(created);
      expect(await repository.findByEmail("missing@example.com")).toBeNull();
      await expect(repository.createUser({ email: "ALICE@example.com", hashedPassword: "another-hash" }))
        .rejects.toMatchObject({ code: "23505" });
    } finally {
      await runUsersMigration(pool, "down");
      await pool.end();
    }
  });
});
