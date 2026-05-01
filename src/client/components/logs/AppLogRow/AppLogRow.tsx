"use client";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/client/components/ui/badge";
import { LogLevelBadge } from "@/client/components/logs/LogLevelBadge";
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

  return (
    <>
      <tr
        className={`border-t hover:bg-muted/30 transition-colors ${hasContext ? "cursor-pointer" : ""}`}
        onClick={() => hasContext && setExpanded((v) => !v)}
      >
        <td className="px-3 py-2 align-middle w-6">
          {hasContext ? (
            expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          ) : null}
        </td>
        <td className="px-3 py-2 align-middle w-44 text-xs text-muted-foreground tabular-nums">
          {new Date(entry.createdAt).toLocaleString()}
        </td>
        <td className="px-3 py-2 align-middle w-20">
          <LogLevelBadge level={entry.level} />
        </td>
        <td className="px-3 py-2 align-middle w-32">
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
            <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-all max-h-72 overflow-y-auto">
              {formatted}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}
