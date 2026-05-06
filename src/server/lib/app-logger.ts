import type { LogLevel } from "@/shared/types/models";
import { logger } from "./logger";
import { redactContext } from "./redact";
import { eventBus } from "./event-bus";

interface LogFields {
  source?: string;
  context?: Record<string, unknown>;
  err?: unknown;
}

function normalizedContext(
  fields?: LogFields,
): Record<string, unknown> | undefined {
  const rawCtx: Record<string, unknown> = { ...(fields?.context ?? {}) };
  if (fields?.err instanceof Error) {
    rawCtx.errorMessage = fields.err.message;
    rawCtx.stack = fields.err.stack;
  } else if (fields?.err !== undefined) {
    rawCtx.errorMessage = String(fields.err);
  }

  const context = redactContext(rawCtx);
  return context && Object.keys(context).length > 0 ? context : undefined;
}

function persist(
  level: LogLevel,
  message: string,
  fields: LogFields | undefined,
  context: Record<string, unknown> | undefined,
) {
  if (!logger.isLevelEnabled(level)) return;

  const ctx = context ?? {};

  const data = {
    level,
    message,
    source: fields?.source ?? null,
    context: Object.keys(ctx).length ? JSON.stringify(ctx) : null,
  };

  // Dynamic import sidesteps the AppLogRepository → BaseRepository → prisma
  // chain happening at module load (would force prisma to init for any
  // module that imports appLogger). Once the row is persisted we push it
  // onto the bus so the /logs SSE stream picks it up without polling.
  import("@/server/repositories/AppLogRepository")
    .then(({ appLogRepository }) =>
      appLogRepository.create(data).then(
        (entry) => eventBus.emit({ type: "applog", entry }),
        (e: unknown) => logger.error(e, "AppLog persist failed"),
      ),
    )
    .catch((e: unknown) => logger.error(e, "AppLog repository import failed"));
}

export const appLogger = {
  debug(msg: string, fields?: LogFields) {
    const context = normalizedContext(fields);
    logger.debug(context, msg);
    persist("debug", msg, fields, context);
  },
  info(msg: string, fields?: LogFields) {
    const context = normalizedContext(fields);
    logger.info(context, msg);
    persist("info", msg, fields, context);
  },
  warn(msg: string, fields?: LogFields) {
    const context = normalizedContext(fields);
    logger.warn(context, msg);
    persist("warn", msg, fields, context);
  },
  error(msg: string, fields?: LogFields) {
    const context = normalizedContext(fields);
    logger.error(context, msg);
    persist("error", msg, fields, context);
  },
};
