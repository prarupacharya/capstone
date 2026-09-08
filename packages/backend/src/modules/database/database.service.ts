import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Pool } from "pg";
import { getDatabasePoolConfig, type DatabaseConfig } from "./database.config";
import { DATABASE_CONFIG } from "./database.tokens";

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool?: Pool;

  constructor(@Inject(DATABASE_CONFIG) private readonly config: DatabaseConfig) {}

  async onModuleInit() {
    if (!this.config.enabled) return;

    this.pool = new Pool(getDatabasePoolConfig(this.config));
    await this.pool.query("SELECT 1");
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }

  getPool() {
    if (!this.pool) throw new Error("Database is not enabled");
    return this.pool;
  }

  async isHealthy() {
    if (!this.pool) return false;

    try {
      await this.pool.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }
}
