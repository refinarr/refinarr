"use client";
import { memo, useMemo } from "react";
import { Badge } from "@/client/components/ui/badge";
import { LogLevelBadge } from "@/client/components/logs/LogLevelBadge";
import { ActionBadge } from "@/client/components/logs/ActionBadge";
import {
  parseLogContext,
  renderMessageWithTitle,
} from "@/client/components/logs/log-utils";
import { cn } from "@/client/lib/utils";
import type { AppLogEntry } from "@/shared/types/models";

interface Props {
  entry: AppLogEntry;
  selected: boolean;
  onSelect: (id: number) => void;
}

function formatTime(d: Date | string): string {
  const date = new Date(d);
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function LogRowImpl({ entry, selected, onSelect }: Props) {
  const { action, title } = useMemo(
    () => parseLogContext(entry.context),
    [entry.context],
  );
  return (
    <button
      type="button"
      onClick={() => onSelect(entry.id)}
      aria-pressed={selected}
      className={cn(
        "flex h-10 w-full items-center gap-3 border-b px-3 text-left text-sm transition-colors",
        "hover:bg-muted/40 focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none",
        selected && "bg-muted/60",
      )}
      title={new Date(entry.createdAt).toLocaleString()}
    >
      <span className="text-muted-foreground w-16 shrink-0 truncate text-xs tabular-nums">
        {formatTime(entry.createdAt)}
      </span>
      <span className="w-16 shrink-0">
        <LogLevelBadge level={entry.level} />
      </span>
      <span className="hidden w-28 shrink-0 truncate sm:inline-flex">
        {entry.source ? (
          <Badge variant="outline" className="text-[10px]">
            {entry.source}
          </Badge>
        ) : null}
      </span>
      <span className="hidden w-24 shrink-0 truncate md:inline-flex">
        {action ? <ActionBadge action={action} /> : null}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium">
        {renderMessageWithTitle(entry.message, title)}
      </span>
    </button>
  );
}

export const LogRow = memo(LogRowImpl);
