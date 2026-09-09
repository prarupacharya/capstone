import type { DatabaseService } from "../src/modules/database/database.service";
import { HealthService } from "../src/modules/health/health.service";

describe("HealthService", () => {
  it("reports an up status when the database probe succeeds", async () => {
    const databaseService = { isHealthy: jest.fn().mockResolvedValue(true) };
    const service = new HealthService(databaseService as unknown as DatabaseService);

    await expect(service.getStatus()).resolves.toEqual({
      status: "up",
      backend: "up",
      database: "up"
    });
    expect(databaseService.isHealthy).toHaveBeenCalledTimes(1);
  });

  it("reports the backend up and database down when the probe fails", async () => {
    const databaseService = { isHealthy: jest.fn().mockResolvedValue(false) };
    const service = new HealthService(databaseService as unknown as DatabaseService);

    await expect(service.getStatus()).resolves.toEqual({
      status: "down",
      backend: "up",
      database: "down"
    });
  });
});
