import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import type { ChatMessage, SaveChatMessageInput } from "./chat-message.types";

interface ChatMessageRow {
  id: string;
  chatroom_id: string;
  sender_id: string;
  sender_email: string;
  sender: string;
  message: string;
  created_at: Date;
}

function mapChatMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    chatroomId: row.chatroom_id,
    senderId: row.sender_id,
    senderEmail: row.sender_email,
    sender: row.sender,
    message: row.message,
    createdAt: row.created_at
  };
}

@Injectable()
export class ChatsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async saveMessage(input: SaveChatMessageInput): Promise<ChatMessage> {
    const result = await this.databaseService.getPool().query<ChatMessageRow>(
      `
        WITH saved AS (
          INSERT INTO chats (chatroom_id, from_user_id, message)
          VALUES ($1, $2, $3)
          RETURNING id, chatroom_id, from_user_id, message, created_at
        )
        SELECT saved.id, saved.chatroom_id, saved.from_user_id AS sender_id,
          users.email AS sender_email, saved.message, saved.created_at,
          COALESCE(users.username, users.email) AS sender
        FROM saved
        JOIN users ON users.id = saved.from_user_id
      `,
      [input.chatroomId, input.fromUserId, input.message.trim()]
    );

    return mapChatMessage(result.rows[0]);
  }

  async listLatestMessages(chatroomId: string): Promise<ChatMessage[]> {
    const result = await this.databaseService.getPool().query<ChatMessageRow>(
      `
        WITH latest AS (
          SELECT chats.id, chats.chatroom_id, chats.from_user_id AS sender_id,
            users.email AS sender_email, chats.message, chats.created_at,
            COALESCE(users.username, users.email) AS sender
          FROM chats
          JOIN users ON users.id = chats.from_user_id
          WHERE chats.chatroom_id = $1
          ORDER BY chats.created_at DESC, chats.id DESC
          LIMIT 50
        )
        SELECT id, chatroom_id, sender_id, sender_email, sender, message, created_at
        FROM latest
        ORDER BY created_at ASC, id ASC
      `,
      [chatroomId]
    );

    return result.rows.map(mapChatMessage);
  }
}
