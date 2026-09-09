import { Pool } from "pg";
import {
  chatSchemaMigration,
  runChatSchemaMigration
} from "../src/modules/database/migrations/002-create-chat-schema";
import { runUsersMigration } from "../src/modules/database/migrations/001-create-users";

describe("chat schema migration", () => {
  it("defines normalized rooms, historical membership, and persisted messages", () => {
    for (const fragment of [
      "id UUID PRIMARY KEY",
      "chatroom_name VARCHAR(100) NOT NULL",
      "LOWER(chatroom_name)",
      "created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
      "user_id UUID NOT NULL REFERENCES users(id)",
      "chatroom_id UUID NOT NULL REFERENCES chatrooms(id)",
      "joined_datetime TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
      "left_datetime TIMESTAMPTZ",
      "from_user_id UUID NOT NULL REFERENCES users(id)",
      "message VARCHAR(2000) NOT NULL",
      "chats_room_created_idx"
    ]) expect(chatSchemaMigration.up).toContain(fragment);

    expect(chatSchemaMigration.down).toContain("DROP TABLE IF EXISTS chats");
    expect(chatSchemaMigration.down).toContain("DROP TABLE IF EXISTS user_chatrooms");
    expect(chatSchemaMigration.down).toContain("DROP TABLE IF EXISTS chatrooms");
  });

  it("selects the requested migration direction", async () => {
    const pool = { query: jest.fn().mockResolvedValue(undefined) };

    await runChatSchemaMigration(pool);
    await runChatSchemaMigration(pool, "down");

    expect(pool.query).toHaveBeenNthCalledWith(1, chatSchemaMigration.up);
    expect(pool.query).toHaveBeenNthCalledWith(2, chatSchemaMigration.down);
  });

  const postgresTest = process.env.TEST_DATABASE_URL ? it : it.skip;
  postgresTest("creates the relational schema and starter rooms", async () => {
    const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });

    try {
      await runChatSchemaMigration(pool, "down");
      await runUsersMigration(pool, "down");
      await runUsersMigration(pool);
      await runChatSchemaMigration(pool);

      const tables = await pool.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' " +
        "AND table_name IN ('chatrooms', 'user_chatrooms', 'chats') ORDER BY table_name"
      );
      expect(tables.rows.map((row) => row.table_name)).toEqual([
        "chatrooms", "chats", "user_chatrooms"
      ]);

      const rooms = await pool.query("SELECT chatroom_name, created_at FROM chatrooms ORDER BY chatroom_name");
      expect(rooms.rows.map((row) => row.chatroom_name)).toEqual([
        "Development", "General", "Random"
      ]);
      expect(rooms.rows.every((row) => row.created_at)).toBe(true);

      await expect(pool.query(
        "INSERT INTO chatrooms (chatroom_name) VALUES ('general')"
      )).rejects.toMatchObject({ code: "23505" });
    } finally {
      await runChatSchemaMigration(pool, "down");
      await runUsersMigration(pool, "down");
      await pool.end();
    }
  });
});
