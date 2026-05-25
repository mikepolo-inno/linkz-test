type LogLevel = "debug" | "info" | "warn" | "error";

type LogPayload = Record<string, unknown>;

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const minLevel: LogLevel =
  (process.env.LOG_LEVEL as LogLevel | undefined) ??
  (process.env.NODE_ENV === "production" ? "info" : "debug");

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minLevel];
}

function emit(level: LogLevel, message: string, payload?: LogPayload) {
  if (!shouldLog(level)) return;

  const entry = {
    level,
    time: new Date().toISOString(),
    message,
    ...payload,
  };

  const sink =
    level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  sink(JSON.stringify(entry));
}

/**
 * Minimal structured logger. Production should swap this for pino/winston, but
 * the call sites stay identical thanks to the namespaced API.
 */
export const logger = {
  debug: (message: string, payload?: LogPayload) => emit("debug", message, payload),
  info: (message: string, payload?: LogPayload) => emit("info", message, payload),
  warn: (message: string, payload?: LogPayload) => emit("warn", message, payload),
  error: (message: string, payload?: LogPayload) => emit("error", message, payload),
};
