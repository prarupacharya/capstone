import { Pool } from "pg";
import { DatabaseService } from "../src/modules/database/database.service";
import { runChatSchemaMigration } from "../src/modules/database/migrations/002-create-chat-schema";
import { runUsersMigration } from "../src/modules/database/migrations/001-create-users";
import { ChatroomsRepository } from "../src/modules/chat/chatrooms.repository";

const rows = [
  {
    id: "room-1",
    chatroom_name: "General",
    created_at: new Date("2026-01-01T00:00:00.000Z")
  },
  {
    id: "room-2",
    chatroom_name: "Random",
    created_at: new Date("2026-01-02T00:00:00.000Z")
  }
];

describe("ChatroomsRepository", () => {
  it("lists and maps rooms, and finds a room by parameterized id", async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rows })
      .mockResolvedValueOnce({ rows: [rows[0]] })
      .mockResolvedValueOnce({ rows: [] });
    const repository = new ChatroomsRepository({
      getPool: () => ({ query })
    } as unknown as DatabaseService);

    await expect(repository.listChatrooms()).resolves.toEqual([
      { id: "room-1", chatroomName: "General", createdAt: rows[0].created_at },
      { id: "room-2", chatroomName: "Random", createdAt: rows[1].created_at }
    ]);
    await expect(repository.findChatroomById("room-1")).resolves.toEqual({
      id: "room-1",
      chatroomName: "General",
      createdAt: rows[0].created_at
    });
    await expect(repository.findChatroomById("missing")).resolves.toBeNull();

    expect(query).toHaveBeenNthCalledWith(1, expect.stringContaining("ORDER BY chatroom_name ASC, id ASC"));
    expect(query).toHaveBeenNthCalledWith(2, expect.stringContaining("WHERE id = $1"), ["room-1"]);
    expect(query).toHaveBeenNthCalledWith(3, expect.stringContaining("WHERE id = $1"), ["missing"]);
  });

  it("propagates database failures", async () => {
    const failure = new Error("database unavailable");
    const repository = new ChatroomsRepository({
      getPool: () => ({ query: jest.fn().mockRejectedValue(failure) })
    } as unknown as DatabaseService);

    await expect(repository.listChatrooms()).rejects.toBe(failure);
  });

  const postgresTest = process.env.TEST_DATABASE_URL ? it : it.skip;
  postgresTest("loads seeded rooms from PostgreSQL", async () => {
    const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    const repository = new ChatroomsRepository({ getPool: () => pool } as unknown as DatabaseService);

    try {
      await runChatSchemaMigration(pool, "down");
      await runUsersMigration(pool, "down");
      await runUsersMigration(pool);
      await runChatSchemaMigration(pool);

      await expect(repository.listChatrooms()).resolves.toEqual([
        expect.objectContaining({ chatroomName: "Development" }),
        expect.objectContaining({ chatroomName: "General" }),
        expect.objectContaining({ chatroomName: "Random" })
      ]);
    } finally {
      await runChatSchemaMigration(pool, "down");
      await runUsersMigration(pool, "down");
      await pool.end();
    }
  });
});
