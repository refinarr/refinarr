import type { LogLevel } from "@/shared/types/models";

const LOG_LEVEL_SET: ReadonlySet<string> = new Set([
  "debug",
  "info",
  "warn",
  "error",
]);

export const isLogLevel = (v: string): v is LogLevel => LOG_LEVEL_SET.has(v);
