import { Module } from "@nestjs/common";
import { parseDatabaseConfig } from "./database.config";
import { DatabaseService } from "./database.service";
import { DATABASE_CONFIG } from "./database.tokens";

@Module({
  providers: [
    { provide: DATABASE_CONFIG, useFactory: parseDatabaseConfig },
    DatabaseService
  ],
  exports: [DatabaseService]
})
export class DatabaseModule {}
