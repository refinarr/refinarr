"use client";
import { useState } from "react";
import type { KeyboardEvent } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/client/components/ui/badge";
import { LogLevelBadge } from "@/client/components/logs/LogLevelBadge";
import { formatRelative } from "@/client/lib/format";
import type { AppLogEntry } from "@/shared/types/models";

interface Props {
  entry: AppLogEntry;
}

function formatContext(ctx: string | null): string | null {
  if (!ctx) return null;
  try {
    return JSON.stringify(JSON.parse(ctx), null, 2);
  } catch {
    return ctx;
  }
}

export function AppLogRow({ entry }: Props) {
  const [expanded, setExpanded] = useState(false);
  const formatted = formatContext(entry.context);
  const hasContext = formatted !== null;
  const toggleExpanded = () => {
    if (hasContext) setExpanded((v) => !v);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (!hasContext) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggleExpanded();
  };

  return (
    <>
      <tr
        className={`hover:bg-muted/30 focus-visible:ring-ring/50 border-t transition-colors focus-visible:ring-2 focus-visible:outline-none ${hasContext ? "cursor-pointer" : ""}`}
        onClick={toggleExpanded}
        onKeyDown={handleKeyDown}
        tabIndex={hasContext ? 0 : -1}
        role={hasContext ? "button" : undefined}
        aria-expanded={hasContext ? expanded : undefined}
      >
        <td className="w-6 px-3 py-2 align-middle">
          {hasContext &&
            (expanded ? (
              <ChevronDown className="text-muted-foreground size-3.5" />
            ) : (
              <ChevronRight className="text-muted-foreground size-3.5" />
            ))}
        </td>
        <td
          className="text-muted-foreground w-44 px-3 py-2 align-middle text-xs tabular-nums"
          title={new Date(entry.createdAt).toLocaleString()}
        >
          {formatRelative(entry.createdAt)}
        </td>
        <td className="w-20 px-3 py-2 align-middle">
          <LogLevelBadge level={entry.level} />
        </td>
        <td className="w-32 px-3 py-2 align-middle">
          {entry.source && (
            <Badge variant="outline" className="text-[10px]">
              {entry.source}
            </Badge>
          )}
        </td>
        <td className="px-3 py-2 align-middle text-sm font-medium">
          {entry.message}
        </td>
      </tr>
      {expanded && formatted && (
        <tr className="bg-muted/20 border-t">
          <td colSpan={5} className="px-3 py-2">
            <pre className="text-muted-foreground max-h-72 overflow-y-auto font-mono text-xs break-all whitespace-pre-wrap">
              {formatted}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}
