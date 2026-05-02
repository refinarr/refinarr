import { Badge } from "@/client/components/ui/badge";
import type { LogLevel } from "@/shared/types/models";

interface Props {
  level: LogLevel;
}

const labels: Record<LogLevel, string> = {
  debug: "Debug",
  info: "Info",
  warn: "Warn",
  error: "Error",
};

const classes: Record<LogLevel, string> = {
  debug: "bg-slate-700/40 text-slate-300 border-slate-600",
  info: "bg-sky-950 text-sky-300 border-sky-800",
  warn: "bg-yellow-950 text-yellow-300 border-yellow-800",
  error: "bg-red-950 text-red-300 border-red-800",
};

export function LogLevelBadge({ level }: Props) {
  return (
    <Badge variant="outline" className={`uppercase tracking-wide text-[10px] ${classes[level]}`}>
      {labels[level]}
    </Badge>
  );
}
