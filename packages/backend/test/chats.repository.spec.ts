import { Pool } from "pg";
import { DatabaseService } from "../src/modules/database/database.service";
import { runChatSchemaMigration } from "../src/modules/database/migrations/002-create-chat-schema";
import { runUsersMigration } from "../src/modules/database/migrations/001-create-users";
import { ChatsRepository } from "../src/modules/chat/chats.repository";

const row = {
  id: "message-1",
  chatroom_id: "room-1",
  sender: "alice@example.com",
  message: "Hello",
  created_at: new Date("2026-01-01T00:00:00.000Z")
};

function createRepository(query: jest.Mock) {
  return new ChatsRepository({ getPool: () => ({ query }) } as unknown as DatabaseService);
}

describe("ChatsRepository", () => {
  it("trims input and maps the database-authored message", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [row] });
    const repository = createRepository(query);

    await expect(repository.saveMessage({
      chatroomId: "room-1", fromUserId: "user-1", message: "  Hello  "
    })).resolves.toEqual({
      id: "message-1", chatroomId: "room-1", sender: "alice@example.com",
      message: "Hello", createdAt: row.created_at
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO chats"), [
      "room-1", "user-1", "Hello"
    ]);
    expect(query.mock.calls[0][0]).toContain("COALESCE(users.username, users.email)");
    expect(query.mock.calls[0][0]).toContain("created_at");
  });

  it("propagates persistence failures", async () => {
    const failure = new Error("message insert failed");
    const repository = createRepository(jest.fn().mockRejectedValue(failure));

    await expect(repository.saveMessage({
      chatroomId: "room-1", fromUserId: "user-1", message: "Hello"
    })).rejects.toBe(failure);
  });

  it("returns a bounded room history in chronological order", async () => {
    const history = [
      { ...row, id: "message-2", message: "Second" },
      { ...row, id: "message-3", message: "Third" }
    ];
    const query = jest.fn().mockResolvedValue({ rows: history });
    const repository = createRepository(query);

    await expect(repository.listLatestMessages("room-1")).resolves.toEqual(history.map((message) => ({
      id: message.id,
      chatroomId: message.chatroom_id,
      sender: message.sender,
      message: message.message,
      createdAt: message.created_at
    })));
    expect(query).toHaveBeenCalledWith(expect.stringContaining("LIMIT 50"), ["room-1"]);
    expect(query.mock.calls[0][0]).toContain("ORDER BY chats.created_at DESC, chats.id DESC");
    expect(query.mock.calls[0][0]).toContain("ORDER BY created_at ASC, id ASC");
  });

  it("returns an empty history for a room without messages", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repository = createRepository(query);

    await expect(repository.listLatestMessages("empty-room")).resolves.toEqual([]);
  });

  const postgresTest = process.env.TEST_DATABASE_URL ? it : it.skip;
  postgresTest("persists messages with foreign keys and server timestamps", async () => {
    const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    const repository = createRepository(pool.query.bind(pool) as jest.Mock);

    try {
      await runChatSchemaMigration(pool, "down");
      await runUsersMigration(pool, "down");
      await runUsersMigration(pool);
      await runChatSchemaMigration(pool);
      const user = await pool.query(
        "INSERT INTO users (email, hashed_password) VALUES ($1, $2) RETURNING id",
        ["message@example.com", "test-hash"]
      );
      const room = await pool.query("SELECT id FROM chatrooms WHERE chatroom_name = 'General'");
      const input = { chatroomId: room.rows[0].id, fromUserId: user.rows[0].id, message: "  Hello  " };

      await expect(repository.saveMessage(input)).resolves.toMatchObject({
        chatroomId: input.chatroomId, sender: "message@example.com", message: "Hello"
      });
      await expect(repository.saveMessage({ ...input, message: "   " })).rejects.toMatchObject({ code: "23514" });
      await expect(repository.saveMessage({ ...input, message: "x".repeat(2001) })).rejects.toMatchObject({ code: "22001" });
      await expect(repository.saveMessage({ ...input, fromUserId: "00000000-0000-0000-0000-000000000000" }))
        .rejects.toMatchObject({ code: "23503" });
      const saved = await pool.query("SELECT from_user_id, message, created_at FROM chats");
      expect(saved.rows[0].from_user_id).toBe(input.fromUserId);
      expect(saved.rows[0].message).toBe("Hello");
      expect(saved.rows[0].created_at).toBeTruthy();
    } finally {
      await runChatSchemaMigration(pool, "down");
      await runUsersMigration(pool, "down");
      await pool.end();
    }
  });

  postgresTest("loads only the latest 50 messages for one room", async () => {
    const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    const repository = createRepository(pool.query.bind(pool) as jest.Mock);

    try {
      await runChatSchemaMigration(pool, "down");
      await runUsersMigration(pool, "down");
      await runUsersMigration(pool);
      await runChatSchemaMigration(pool);
      const user = await pool.query(
        "INSERT INTO users (email, hashed_password) VALUES ($1, $2) RETURNING id",
        ["history@example.com", "test-hash"]
      );
      const rooms = await pool.query(
        "SELECT id, chatroom_name FROM chatrooms WHERE chatroom_name IN ('General', 'Random')"
      );
      const general = rooms.rows.find((room) => room.chatroom_name === "General").id;
      const random = rooms.rows.find((room) => room.chatroom_name === "Random").id;
      await pool.query(
        `
          INSERT INTO chats (chatroom_id, from_user_id, message, created_at)
          SELECT $1, $2, CONCAT('Message ', number), CURRENT_TIMESTAMP + (number * interval '1 second')
          FROM generate_series(1, 51) AS sequence(number)
        `,
        [general, user.rows[0].id]
      );
      await pool.query(
        "INSERT INTO chats (chatroom_id, from_user_id, message) VALUES ($1, $2, $3)",
        [random, user.rows[0].id, "Other room"]
      );

      const history = await repository.listLatestMessages(general);
      expect(history).toHaveLength(50);
      expect(history[0].message).toBe("Message 2");
      expect(history[49].message).toBe("Message 51");
      expect(history.every((message) => message.chatroomId === general)).toBe(true);
      expect(history.every((message, index) => index === 0 ||
        message.createdAt >= history[index - 1].createdAt)).toBe(true);
    } finally {
      await runChatSchemaMigration(pool, "down");
      await runUsersMigration(pool, "down");
      await pool.end();
    }
  });
});
