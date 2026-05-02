import { logger } from "./logger";
import type { LogLevel } from "@/shared/types/models";

interface LogFields {
  source?: string;
  context?: Record<string, unknown>;
  err?: unknown;
}

function persist(level: LogLevel, message: string, fields?: LogFields) {
  if (!logger.isLevelEnabled(level)) return;

  const ctx: Record<string, unknown> = { ...(fields?.context ?? {}) };
  if (fields?.err instanceof Error) {
    ctx.errorMessage = fields.err.message;
    ctx.stack = fields.err.stack;
  } else if (fields?.err !== undefined) {
    ctx.errorMessage = String(fields.err);
  }

  const data = {
    level,
    message,
    source: fields?.source ?? null,
    context: Object.keys(ctx).length ? JSON.stringify(ctx) : null,
  };

  import("@/server/repositories/AppLogRepository")
    .then(({ appLogRepository }) =>
      appLogRepository.create(data).catch((e: unknown) => logger.error(e, "AppLog persist failed"))
    )
    .catch((e: unknown) => logger.error(e, "AppLog repository import failed"));
}

export const appLogger = {
  debug(msg: string, fields?: LogFields) {
    logger.debug(fields?.context, msg);
    persist("debug", msg, fields);
  },
  info(msg: string, fields?: LogFields) {
    logger.info(fields?.context, msg);
    persist("info", msg, fields);
  },
  warn(msg: string, fields?: LogFields) {
    logger.warn(fields?.context, msg);
    persist("warn", msg, fields);
  },
  error(msg: string, fields?: LogFields) {
    logger.error({ ...(fields?.context ?? {}), err: fields?.err }, msg);
    persist("error", msg, fields);
  },
};
