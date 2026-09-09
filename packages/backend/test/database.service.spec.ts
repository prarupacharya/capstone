import { Pool } from "pg";
import { DatabaseService } from "../src/modules/database/database.service";
import type { DatabaseConfig } from "../src/modules/database/database.config";

jest.mock("pg", () => ({ Pool: jest.fn() }));

const PoolMock = Pool as unknown as jest.Mock;
const enabledConfig: DatabaseConfig = {
  enabled: true,
  host: "db",
  port: 5433,
  name: "app",
  user: "app_user",
  password: "secret"
};

describe("DatabaseService", () => {
  beforeEach(() => {
    PoolMock.mockReset();
  });

  it("does not connect when the database is disabled", async () => {
    const service = new DatabaseService({ ...enabledConfig, enabled: false });

    await service.onModuleInit();

    expect(PoolMock).not.toHaveBeenCalled();
    expect(await service.isHealthy()).toBe(false);
    expect(() => service.getPool()).toThrow("Database is not enabled");
    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
  });

  it("initializes a pool, probes it, and closes it", async () => {
    const pool = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      end: jest.fn().mockResolvedValue(undefined)
    };
    PoolMock.mockImplementation(() => pool);
    const service = new DatabaseService(enabledConfig);

    await service.onModuleInit();

    expect(PoolMock).toHaveBeenCalledWith({
      host: "db",
      port: 5433,
      database: "app",
      user: "app_user",
      password: "secret"
    });
    expect(pool.query).toHaveBeenCalledWith("SELECT 1");
    expect(service.getPool()).toBe(pool);
    expect(await service.isHealthy()).toBe(true);

    await service.onModuleDestroy();
    expect(pool.end).toHaveBeenCalledTimes(1);
  });

  it("propagates initialization failures and reports an unhealthy pool", async () => {
    const pool = {
      query: jest.fn().mockRejectedValue(new Error("connection failed")),
      end: jest.fn().mockResolvedValue(undefined)
    };
    PoolMock.mockImplementation(() => pool);
    const service = new DatabaseService(enabledConfig);

    await expect(service.onModuleInit()).rejects.toThrow("connection failed");
    expect(await service.isHealthy()).toBe(false);

    await service.onModuleDestroy();
    expect(pool.end).toHaveBeenCalledTimes(1);
  });
});
