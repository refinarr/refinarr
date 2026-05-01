import { logger } from "./logger";

interface LogFields {
  source?: string;
  context?: Record<string, unknown>;
  err?: unknown;
}

function persist(level: "warn" | "error", message: string, fields?: LogFields) {
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

  // Lazy import avoids circular-dep and stale-module issues at startup
  import("@/server/repositories/AppLogRepository")
    .then(({ appLogRepository }) =>
      appLogRepository.create(data).catch((e: unknown) => logger.error(e, "AppLog persist failed"))
    )
    .catch((e: unknown) => logger.error(e, "AppLog repository import failed"));
}

export const appLogger = {
  info(msg: string, fields?: LogFields) {
    logger.info(fields?.context, msg);
  },
  debug(msg: string, fields?: LogFields) {
    logger.debug(fields?.context, msg);
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
