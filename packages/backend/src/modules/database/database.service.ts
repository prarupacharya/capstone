import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Pool, type PoolConfig } from "pg";
import type { DatabaseConfig } from "./database.config";
import { DATABASE_CONFIG } from "./database.tokens";

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool?: Pool;

  constructor(@Inject(DATABASE_CONFIG) private readonly config: DatabaseConfig) {}

  async onModuleInit() {
    if (!this.config.enabled) return;

    const options: PoolConfig = {
      host: this.config.host,
      port: this.config.port,
      database: this.config.name,
      user: this.config.user,
      password: this.config.password
    };

    this.pool = new Pool(options);
    await this.pool.query("SELECT 1");
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }

  getPool() {
    if (!this.pool) throw new Error("Database is not enabled");
    return this.pool;
  }
}
