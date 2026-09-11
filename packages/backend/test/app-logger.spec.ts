jest.mock("node:fs", () => ({ appendFileSync: jest.fn(), mkdirSync: jest.fn() }));

import { appendFileSync, mkdirSync } from "node:fs";
import { AppLogger } from "../src/common/logging/app-logger";

const append = appendFileSync as jest.Mock, mkdir = mkdirSync as jest.Mock;

function getRecords(output: jest.SpyInstance) {
  return output.mock.calls.map(([line]) => JSON.parse(line as string) as Record<string, unknown>);
}

describe("AppLogger", () => {
  let logger: AppLogger;
  let output: jest.SpyInstance;

  beforeEach(() => {
    logger = new AppLogger();
    output = jest.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => output.mockRestore());

  it("supports every level adapter and emits structured JSON", () => {
    logger.write("INFO", "message", {
      requestId: "abc",
      timestamp: "spoofed",
      level: "spoofed",
      message: "spoofed"
    });
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

    const records = getRecords(output);
    expect(records).toHaveLength(11);
    expect(records[0]).toEqual(expect.objectContaining({
      requestId: "abc",
      level: "INFO",
      message: "message"
    }));
    expect(records.every(({ timestamp }) => typeof timestamp === "string" && !Number.isNaN(Date.parse(timestamp as string)))).toBe(true);
    expect(records.map(({ level }) => level)).toEqual([
      "INFO", "INFO", "ERROR", "WARN", "DEBUG", "VERBOSE",
      "INFO", "ERROR", "WARN", "DEBUG", "VERBOSE"
    ]);
  });

  it("sanitizes file methods and logs recoverable write failures", () => {
    logger.writeToFile("get/users", "INFO", "saved");
    expect(mkdir).toHaveBeenCalledWith(expect.stringMatching(/GET_USERS$/), { recursive: true });
    const savedPath = append.mock.calls[0][0] as string;
    const savedLine = append.mock.calls[0][1] as string;
    expect(savedPath).toMatch(/GET_USERS[\\/]\d{4}-\d{2}-\d{2}\.log$/);
    expect(savedLine).toMatch(/\n$/);
    expect(JSON.parse(savedLine)).toEqual(expect.objectContaining({ level: "INFO", message: "saved" }));

    mkdir.mockImplementationOnce(() => { throw new Error("disk offline"); });
    logger.writeToFile("", "WARN", "failed");
    expect(getRecords(output)).toEqual(expect.arrayContaining([
      expect.objectContaining({ level: "ERROR", message: "Failed to write request log file", method: "UNKNOWN", error: "disk offline" })
    ]));
    expect(output).toHaveBeenCalledTimes(3);

    append.mockImplementationOnce(() => { throw "write failed"; });
    logger.writeToFile("PUT", "INFO", "failed");
    expect(getRecords(output)).toEqual(expect.arrayContaining([
      expect.objectContaining({ level: "ERROR", message: "Failed to write request log file", error: "write failed" })
    ]));
  });
});
