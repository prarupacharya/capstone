import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class HealthService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getStatus() {
    const database = (await this.databaseService.isHealthy()) ? "up" : "down";

    return {
      status: database === "up" ? "up" : "down",
      backend: "up",
      database
    };
  }
}
