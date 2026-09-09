import {
  getDatabasePoolConfig,
  parseDatabaseConfig
} from "../src/modules/database/database.config";

describe("database configuration", () => {
  it("uses disabled local database defaults", () => {
    expect(parseDatabaseConfig({})).toEqual({
      enabled: false,
      host: "localhost",
      port: 5432,
      name: "capstone",
      user: "capstone",
      password: "capstone"
    });
  });

  it("parses database overrides and maps pool options", () => {
    const config = parseDatabaseConfig({
      DATABASE_ENABLED: "true",
      DATABASE_HOST: "db",
      DATABASE_PORT: "5433",
      DATABASE_NAME: "app",
      DATABASE_USER: "app_user",
      DATABASE_PASSWORD: "secret"
    });

    expect(config).toEqual({
      enabled: true,
      host: "db",
      port: 5433,
      name: "app",
      user: "app_user",
      password: "secret"
    });
    expect(getDatabasePoolConfig(config)).toEqual({
      host: "db",
      port: 5433,
      database: "app",
      user: "app_user",
      password: "secret"
    });
  });

  it("uses defaults for blank connection settings", () => {
    expect(parseDatabaseConfig({
      DATABASE_HOST: " ",
      DATABASE_PORT: " ",
      DATABASE_NAME: " ",
      DATABASE_USER: " "
    })).toMatchObject({
      enabled: false,
      host: "localhost",
      port: 5432,
      name: "capstone",
      user: "capstone"
    });
  });

  it("rejects invalid database settings", () => {
    expect(() => parseDatabaseConfig({ DATABASE_ENABLED: "yes" })).toThrow(/DATABASE_ENABLED/);
    for (const port of ["abc", "0", "65536"]) {
      expect(() => parseDatabaseConfig({ DATABASE_PORT: port })).toThrow(/DATABASE_PORT/);
    }
  });
});
