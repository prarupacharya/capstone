import { appendFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { Injectable, type LoggerService } from "@nestjs/common";

export type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG" | "VERBOSE";
const logsDirectory = resolve(__dirname, "../../../logs");

/**
 * Writes backend logs in the format used by the application:
 * [2025-10-06T13:30:00.000Z] [INFO] - Message {"key":"value"}
 */
@Injectable()
export class AppLogger implements LoggerService {
  write(level: LogLevel, message: string, metadata?: Record<string, unknown>) {
    this.output(this.formatLine(level, message, metadata));
  }

  writeToFile(
    method: string,
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>
  ) {
    const line = this.formatLine(level, message, metadata);
    this.output(line);

    const safeMethod = method.toUpperCase().replace(/[^A-Z0-9_-]/g, "_") || "UNKNOWN";
    const logDirectory = resolve(logsDirectory, safeMethod);
    const logFile = resolve(logDirectory, `${line.slice(1, 11)}.log`);

    try {
      mkdirSync(logDirectory, { recursive: true });
      appendFileSync(logFile, `${line}\n`, "utf8");
    } catch (error) {
      this.write("ERROR", "Failed to write request log file", {
        method: safeMethod,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private formatLine(level: LogLevel, message: string, metadata?: Record<string, unknown>) {
    const serializedMetadata = metadata ? ` ${JSON.stringify(metadata)}` : "";

    return `[${new Date().toISOString()}] [${level}] - ${message}${serializedMetadata}`;
  }

  private output(line: string) {
    console.log(line);
  }

  log(message: unknown, context?: string) {
    this.write("INFO", String(message), context ? { context } : undefined);
  }

  error(message: unknown, trace?: string, context?: string) {
    const metadata = {
      ...(context ? { context } : {}),
      ...(trace ? { trace } : {})
    };

    this.write("ERROR", String(message), Object.keys(metadata).length ? metadata : undefined);
  }

  warn(message: unknown, context?: string) {
    this.write("WARN", String(message), context ? { context } : undefined);
  }

  debug(message: unknown, context?: string) {
    this.write("DEBUG", String(message), context ? { context } : undefined);
  }

  verbose(message: unknown, context?: string) {
    this.write("VERBOSE", String(message), context ? { context } : undefined);
  }
}
