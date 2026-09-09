import { Pool } from "pg";
import { DatabaseService } from "../src/modules/database/database.service";
import { runChatSchemaMigration } from "../src/modules/database/migrations/002-create-chat-schema";
import { runUsersMigration } from "../src/modules/database/migrations/001-create-users";
import { UserChatroomsRepository } from "../src/modules/chat/user-chatrooms.repository";

function createRepository(client: { query: jest.Mock; release: jest.Mock }) {
  const pool = { connect: jest.fn().mockResolvedValue(client) };
  return new UserChatroomsRepository({ getPool: () => pool } as unknown as DatabaseService);
}

describe("UserChatroomsRepository", () => {
  it("reports whether it created a membership without replacing an open interval", async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce(undefined).mockResolvedValueOnce({ rowCount: 1 }).mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined).mockResolvedValueOnce({ rowCount: 0 }).mockResolvedValueOnce(undefined),
      release: jest.fn()
    };
    const repository = createRepository(client);

    await expect(repository.beginMembership("user-1", "room-1")).resolves.toBe(true);
    await expect(repository.beginMembership("user-1", "room-1")).resolves.toBe(false);
    expect(client.query.mock.calls.map(([query]) => query)).toEqual([
      "BEGIN", expect.stringContaining("ON CONFLICT"), "COMMIT",
      "BEGIN", expect.stringContaining("ON CONFLICT"), "COMMIT"
    ]);
    expect(client.query.mock.calls[1][1]).toEqual(["user-1", "room-1"]);
    expect(client.query.mock.calls[4][0]).not.toContain("SET left_datetime");
  });

  it("counts only active room memberships", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{ count: 2 }] });
    const repository = new UserChatroomsRepository({
      getPool: () => ({ query })
    } as unknown as DatabaseService);

    await expect(repository.countActiveMembers("room-1")).resolves.toBe(2);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("left_datetime IS NULL"),
      ["room-1"]
    );
  });

  it("ends the current interval and reports whether one existed", async () => {
    const client = { query: jest.fn().mockResolvedValue({ rowCount: 1 }), release: jest.fn() };
    const repository = createRepository(client);

    await expect(repository.endMembership("user-1", "room-1")).resolves.toBe(true);
    expect(client.query.mock.calls[1][0]).toEqual(expect.stringContaining("left_datetime IS NULL"));
    client.query.mockReset();
    client.query.mockResolvedValueOnce(undefined).mockResolvedValueOnce({ rowCount: 0 }).mockResolvedValueOnce(undefined);
    await expect(repository.endMembership("user-1", "room-1")).resolves.toBe(false);
  });

  it("rolls back and releases the client when opening fails", async () => {
    const failure = new Error("membership insert failed");
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce(undefined).mockRejectedValueOnce(failure)
        .mockResolvedValueOnce(undefined),
      release: jest.fn()
    };
    const repository = createRepository(client);

    await expect(repository.beginMembership("user-1", "room-1")).rejects.toBe(failure);
    expect(client.query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  const postgresTest = process.env.TEST_DATABASE_URL ? it : it.skip;
  postgresTest("keeps one active interval and preserves history after rejoining", async () => {
    const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    const repository = new UserChatroomsRepository({ getPool: () => pool } as unknown as DatabaseService);

    try {
      await runChatSchemaMigration(pool, "down");
      await runUsersMigration(pool, "down");
      await runUsersMigration(pool);
      await runChatSchemaMigration(pool);
      const user = await pool.query(
        "INSERT INTO users (email, hashed_password) VALUES ($1, $2) RETURNING id",
        ["membership@example.com", "test-hash"]
      );
      const room = await pool.query("SELECT id FROM chatrooms WHERE chatroom_name = 'General'");
      const userId = user.rows[0].id;
      const roomId = room.rows[0].id;
      const concurrentJoins = await Promise.all([
        repository.beginMembership(userId, roomId),
        repository.beginMembership(userId, roomId)
      ]);
      const intervals = await pool.query(
        "SELECT joined_datetime, left_datetime FROM user_chatrooms WHERE user_id = $1 AND chatroom_id = $2 ORDER BY joined_datetime",
        [userId, roomId]
      );

      expect(concurrentJoins.sort()).toEqual([false, true]);
      expect(intervals.rows).toHaveLength(1);
      expect(intervals.rows[0].left_datetime).toBeNull();
      await expect(repository.countActiveMembers(roomId)).resolves.toBe(1);
      await expect(repository.endMembership(userId, roomId)).resolves.toBe(true);
      await expect(repository.endMembership(userId, roomId)).resolves.toBe(false);
      await expect(repository.countActiveMembers(roomId)).resolves.toBe(0);
      await expect(repository.beginMembership(userId, roomId)).resolves.toBe(true);
      const rejoinedIntervals = await pool.query(
        "SELECT left_datetime FROM user_chatrooms WHERE user_id = $1 AND chatroom_id = $2 ORDER BY joined_datetime",
        [userId, roomId]
      );
      expect(rejoinedIntervals.rows).toHaveLength(2);
      expect(rejoinedIntervals.rows[0].left_datetime).toBeTruthy();
      expect(rejoinedIntervals.rows[1].left_datetime).toBeNull();
      await expect(repository.beginMembership("00000000-0000-0000-0000-000000000000", roomId))
        .rejects.toMatchObject({ code: "23503" });
    } finally {
      await runChatSchemaMigration(pool, "down");
      await runUsersMigration(pool, "down");
      await pool.end();
    }
  });
});
