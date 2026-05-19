import { createLogger, format, transports } from "winston";
import path from "path";
import fs from "fs";

const logDir = path.resolve(process.cwd(), "logs");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const { combine, timestamp, printf, colorize, errors } = format;

const consoleFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  const body = stack ? `${message}\n${stack}` : message;
  return `${timestamp} [${level}] ${body}${metaStr}`;
});

export const logger = createLogger({
  level: process.env.LOG_LEVEL ?? "info",
  format: combine(
    errors({ stack: true }),
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  ),
  transports: [
    new transports.Console({
      format: combine(colorize(), timestamp({ format: "HH:mm:ss" }), consoleFormat),
    }),
    new transports.File({
      filename: path.join(logDir, "scraper.log"),
      format: combine(timestamp(), format.json()),
      maxsize: 10 * 1024 * 1024, // 10 MB
      maxFiles: 5,
    }),
    new transports.File({
      filename: path.join(logDir, "errors.log"),
      level: "error",
      format: combine(timestamp(), format.json()),
    }),
  ],
});

/** Scoped logger factory — attaches a fixed `scope` meta field */
export function scopedLogger(scope: string) {
  return logger.child({ scope });
}
