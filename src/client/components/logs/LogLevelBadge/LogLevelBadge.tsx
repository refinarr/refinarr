import { useTranslations } from "next-intl";
import { Badge } from "@/client/components/ui/badge";
import type { LogLevel } from "@/shared/types/models";

interface Props {
  level: LogLevel;
}

const classes: Record<LogLevel, string> = {
  debug: "bg-neutral-soft text-neutral-foreground border-border",
  info: "bg-info-soft text-info border-info/30",
  warn: "bg-warning-soft text-warning border-warning/30",
  error: "bg-critical-soft text-critical border-critical/30",
};

export function LogLevelBadge({ level }: Props) {
  const t = useTranslations("logs.badgeLevels");
  return (
    <Badge
      variant="outline"
      className={`text-[10px] tracking-wide uppercase ${classes[level]}`}
    >
      {t(level)}
    </Badge>
  );
}
