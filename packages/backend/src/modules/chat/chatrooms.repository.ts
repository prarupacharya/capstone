import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import type { Chatroom, ChatroomSummary } from "./chatroom.types";

interface ChatroomRow {
  id: string;
  chatroom_name: string;
  created_at: Date;
}

interface ChatroomSummaryRow extends ChatroomRow {
  number_of_users: number;
  is_member: boolean;
}

function mapChatroom(row: ChatroomRow): Chatroom {
  return {
    id: row.id,
    chatroomName: row.chatroom_name,
    createdAt: row.created_at
  };
}

@Injectable()
export class ChatroomsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async listChatrooms(): Promise<Chatroom[]> {
    const result = await this.databaseService.getPool().query<ChatroomRow>(
      `
        SELECT id, chatroom_name, created_at
        FROM chatrooms
        ORDER BY chatroom_name ASC, id ASC
      `
    );

    return result.rows.map(mapChatroom);
  }

  async listChatroomSummaries(userId: string): Promise<ChatroomSummary[]> {
    const result = await this.databaseService.getPool().query<ChatroomSummaryRow>(
      `
        SELECT chatrooms.id, chatrooms.chatroom_name, chatrooms.created_at,
          COUNT(memberships.id)::integer AS number_of_users,
          COALESCE(BOOL_OR(memberships.user_id = $1), false) AS is_member
        FROM chatrooms
        LEFT JOIN user_chatrooms memberships
          ON memberships.chatroom_id = chatrooms.id AND memberships.left_datetime IS NULL
        GROUP BY chatrooms.id
        ORDER BY chatrooms.chatroom_name ASC, chatrooms.id ASC
      `,
      [userId]
    );

    return result.rows.map((row) => ({
      ...mapChatroom(row),
      numberOfUsers: row.number_of_users,
      isMember: row.is_member
    }));
  }

  async findChatroomById(id: string): Promise<Chatroom | null> {
    const result = await this.databaseService.getPool().query<ChatroomRow>(
      `
        SELECT id, chatroom_name, created_at
        FROM chatrooms
        WHERE id = $1
        LIMIT 1
      `,
      [id]
    );

    return result.rows[0] ? mapChatroom(result.rows[0]) : null;
  }
}
