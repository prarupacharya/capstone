import { Pool } from "pg";
import { getDatabasePoolConfig, parseDatabaseConfig, type DatabaseConfig } from "../src/modules/database/database.config";
import { migrate } from "../src/modules/database/migrate";
import { runUsersMigration } from "../src/modules/database/migrations/001-create-users";

jest.mock("pg", () => ({ Pool: jest.fn() }));
jest.mock("../src/modules/database/database.config", () => ({
  getDatabasePoolConfig: jest.fn(),
  parseDatabaseConfig: jest.fn()
}));
jest.mock("../src/modules/database/migrations/001-create-users", () => ({
  runUsersMigration: jest.fn()
}));

const PoolMock = Pool as unknown as jest.Mock;
const parseConfigMock = parseDatabaseConfig as jest.Mock;
const poolConfigMock = getDatabasePoolConfig as jest.Mock;
const migrationMock = runUsersMigration as jest.Mock;
const config: DatabaseConfig = { enabled: true, host: "db", port: 5433, name: "app", user: "app_user", password: "secret" };
const poolConfig = { host: "db", port: 5433, database: "app", user: "app_user", password: "secret" };

describe("migrate", () => {
  const pool = { end: jest.fn().mockResolvedValue(undefined) };

  beforeEach(() => {
    jest.clearAllMocks();
    PoolMock.mockImplementation(() => pool);
    parseConfigMock.mockReturnValue(config);
    poolConfigMock.mockReturnValue(poolConfig);
    migrationMock.mockResolvedValue(undefined);
  });

  it("rejects disabled database configuration", async () => {
    parseConfigMock.mockReturnValue({ ...config, enabled: false });

    await expect(migrate()).rejects.toThrow("DATABASE_ENABLED");
    expect(PoolMock).not.toHaveBeenCalled();
    expect(migrationMock).not.toHaveBeenCalled();
  });

  it("runs the users migration and closes the pool", async () => {
    await migrate();

    expect(poolConfigMock).toHaveBeenCalledWith(config);
    expect(PoolMock).toHaveBeenCalledWith(poolConfig);
    expect(migrationMock).toHaveBeenCalledWith(pool);
    expect(pool.end).toHaveBeenCalledTimes(1);
  });

  it("closes the pool when migration fails", async () => {
    const failure = new Error("migration failed");
    migrationMock.mockRejectedValue(failure);

    await expect(migrate()).rejects.toBe(failure);
    expect(pool.end).toHaveBeenCalledTimes(1);
  });
});
