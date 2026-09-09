import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import type { Chatroom } from "./chatroom.types";

interface ChatroomRow {
  id: string;
  chatroom_name: string;
  created_at: Date;
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
