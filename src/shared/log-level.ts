import type { LogLevel } from "@/shared/types/models";

const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;

export const isLogLevel = (v: string): v is LogLevel =>
  (LOG_LEVELS as readonly string[]).includes(v);
