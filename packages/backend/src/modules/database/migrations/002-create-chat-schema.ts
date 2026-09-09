import type { Pool } from "pg";

export const chatSchemaMigration = {
  name: "002-create-chat-schema",
  up: `
    CREATE TABLE IF NOT EXISTS chatrooms (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      chatroom_name VARCHAR(100) NOT NULL
        CHECK (chatroom_name = btrim(chatroom_name) AND char_length(chatroom_name) BETWEEN 1 AND 100),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX IF NOT EXISTS chatrooms_name_unique ON chatrooms (LOWER(chatroom_name));

    CREATE TABLE IF NOT EXISTS user_chatrooms (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id),
      chatroom_id UUID NOT NULL REFERENCES chatrooms(id),
      joined_datetime TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      left_datetime TIMESTAMPTZ
    );
    CREATE UNIQUE INDEX IF NOT EXISTS user_chatrooms_active_unique
      ON user_chatrooms (user_id, chatroom_id) WHERE left_datetime IS NULL;

    CREATE TABLE IF NOT EXISTS chats (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      chatroom_id UUID NOT NULL REFERENCES chatrooms(id),
      from_user_id UUID NOT NULL REFERENCES users(id),
      message VARCHAR(2000) NOT NULL
        CHECK (char_length(btrim(message)) BETWEEN 1 AND 2000),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS chats_room_created_idx ON chats (chatroom_id, created_at DESC, id DESC);

    INSERT INTO chatrooms (chatroom_name)
    VALUES ('General'), ('Development'), ('Random')
    ON CONFLICT DO NOTHING;
  `,
  down: `
    DROP TABLE IF EXISTS chats;
    DROP TABLE IF EXISTS user_chatrooms;
    DROP TABLE IF EXISTS chatrooms;
  `
};

export async function runChatSchemaMigration(
  pool: Pick<Pool, "query">,
  direction: "up" | "down" = "up"
) {
  await pool.query(direction === "up" ? chatSchemaMigration.up : chatSchemaMigration.down);
}
