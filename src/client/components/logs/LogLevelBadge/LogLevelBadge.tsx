import { Badge } from "@/client/components/ui/badge";
import type { LogLevel } from "@/shared/types/models";

interface Props {
  level: LogLevel;
}

const labels: Record<LogLevel, string> = {
  warn: "Warn",
  error: "Error",
};

export function LogLevelBadge({ level }: Props) {
  return (
    <Badge variant={level === "error" ? "destructive" : "secondary"} className="uppercase tracking-wide text-[10px]">
      {labels[level]}
    </Badge>
  );
}
