import { appendFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { Injectable, type LoggerService } from "@nestjs/common";

export type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG" | "VERBOSE";
const logsDirectory = resolve(__dirname, "../../../logs");

/** Writes one structured JSON object per backend log line. */
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
    const record = this.formatRecord(level, message, metadata);
    const line = JSON.stringify(record);
    this.output(line);

    const safeMethod = method.toUpperCase().replace(/[^A-Z0-9_-]/g, "_") || "UNKNOWN";
    const logDirectory = resolve(logsDirectory, safeMethod);
    const logFile = resolve(logDirectory, `${record.timestamp.slice(0, 10)}.log`);

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

  private formatRecord(level: LogLevel, message: string, metadata?: Record<string, unknown>) {
    return {
      ...(metadata ?? {}),
      timestamp: new Date().toISOString(),
      level,
      message
    };
  }

  private formatLine(level: LogLevel, message: string, metadata?: Record<string, unknown>) {
    return JSON.stringify(this.formatRecord(level, message, metadata));
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
