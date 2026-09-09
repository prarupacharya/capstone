jest.mock("node:fs", () => ({ appendFileSync: jest.fn(), mkdirSync: jest.fn() }));

import { appendFileSync, mkdirSync } from "node:fs";
import { AppLogger } from "../src/common/logging/app-logger";

const append = appendFileSync as jest.Mock, mkdir = mkdirSync as jest.Mock;

describe("AppLogger", () => {
  let logger: AppLogger;
  let output: jest.SpyInstance;

  beforeEach(() => {
    logger = new AppLogger();
    output = jest.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => output.mockRestore());

  it("supports every level adapter and formats metadata", () => {
    logger.write("INFO", "message", { requestId: "abc" });
    logger.log("log", "ctx");
    logger.error("error", "trace", "ctx");
    logger.warn("warn", "ctx");
    logger.debug("debug", "ctx");
    logger.verbose("verbose", "ctx");
    logger.log("plain");
    logger.error("plain");
    logger.warn("plain");
    logger.debug("plain");
    logger.verbose("plain");

    expect(output.mock.calls[0][0]).toMatch(/\[INFO\] - message \{"requestId":"abc"\}$/);
    expect(output).toHaveBeenCalledWith(expect.stringContaining("[ERROR] - error"));
    expect(output).toHaveBeenCalledWith(expect.stringContaining("[VERBOSE] - verbose"));
  });

  it("sanitizes file methods and logs recoverable write failures", () => {
    logger.writeToFile("get/users", "INFO", "saved");
    expect(mkdir).toHaveBeenCalledWith(expect.stringMatching(/GET_USERS$/), { recursive: true });
    expect(append).toHaveBeenCalledWith(expect.stringMatching(/GET_USERS[\\/]\d{4}-\d{2}-\d{2}\.log$/), expect.stringContaining("saved"), "utf8");

    mkdir.mockImplementationOnce(() => { throw new Error("disk offline"); });
    logger.writeToFile("", "WARN", "failed");
    expect(output).toHaveBeenCalledWith(expect.stringContaining("[ERROR] - Failed to write request log file"));
    expect(output).toHaveBeenCalledWith(expect.stringContaining('"method":"UNKNOWN"'));
    expect(output).toHaveBeenCalledWith(expect.stringContaining('"error":"disk offline"'));
    expect(output).toHaveBeenCalledTimes(3);

    append.mockImplementationOnce(() => { throw "write failed"; });
    logger.writeToFile("PUT", "INFO", "failed");
    expect(output).toHaveBeenCalledWith(expect.stringContaining('"error":"write failed"'));
  });
});
