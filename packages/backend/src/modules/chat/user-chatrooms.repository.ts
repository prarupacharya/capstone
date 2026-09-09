import { Injectable } from "@nestjs/common";
import type { PoolClient } from "pg";
import { DatabaseService } from "../database/database.service";

type TransactionPool = Pick<ReturnType<DatabaseService["getPool"]>, "connect">;

@Injectable()
export class UserChatroomsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async beginMembership(userId: string, chatroomId: string): Promise<boolean> {
    return this.withTransaction(async (client) => {
      const result = await client.query(
        `
          INSERT INTO user_chatrooms (user_id, chatroom_id)
          VALUES ($1, $2)
          ON CONFLICT (user_id, chatroom_id) WHERE left_datetime IS NULL
          DO NOTHING
          RETURNING id
        `,
        [userId, chatroomId]
      );

      return result.rowCount === 1;
    });
  }

  async countActiveMembers(chatroomId: string): Promise<number> {
    const result = await this.databaseService.getPool().query<{ count: number }>(
      `
        SELECT COUNT(*)::integer AS count
        FROM user_chatrooms
        WHERE chatroom_id = $1 AND left_datetime IS NULL
      `,
      [chatroomId]
    );

    return result.rows[0].count;
  }

  async endMembership(userId: string, chatroomId: string): Promise<boolean> {
    return this.withTransaction(async (client) => {
      const result = await client.query(
        `
          UPDATE user_chatrooms
          SET left_datetime = CURRENT_TIMESTAMP
          WHERE user_id = $1 AND chatroom_id = $2 AND left_datetime IS NULL
        `,
        [userId, chatroomId]
      );

      return result.rowCount === 1;
    });
  }

  private async withTransaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await (this.databaseService.getPool() as TransactionPool).connect();

    try {
      await client.query("BEGIN");
      const result = await operation(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
