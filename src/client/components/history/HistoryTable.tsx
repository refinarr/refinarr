"use client";
import type { ReactElement } from "react";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { formatRelative } from "@/client/lib/format";
import type { ActionLog, ActionStatus } from "@/shared/types/models";
import { ActionStatusBadge } from "./ActionStatusBadge";
import { ActionTypeBadge } from "./ActionTypeBadge";
import { RetryButton } from "./RetryButton";

interface Props {
  logs: ActionLog[];
}

// Output of `groupLogs`. A group with a single child OR a null groupId
// renders flat (current behavior). A group with >1 children renders a
// parent header row above the indented children, default-collapsed so a
// large bulk action doesn't blow up the page.
type Group =
  | { kind: "flat"; row: ActionLog }
  | { kind: "batch"; rows: ActionLog[] };

// Bucket consecutive rows with the same non-null groupId. Logs come in
// already sorted descending by createdAt (most recent first), so a
// linear scan keeps each batch's rows together. Rows with `groupId ===
// null` are passed through as flat groups regardless of position.
//
// A 1-row "group" renders flat — the bulk client only stamps a groupId
// on submissions of >1 items, and pending queue rows are synthesized
// into the history feed at the API layer so all N siblings of a batch
// are visible from the moment of submit. By the time a 1-row group
// reaches us, it's a genuinely solo entry.
function groupLogs(logs: ActionLog[]): Group[] {
  const out: Group[] = [];
  let i = 0;
  while (i < logs.length) {
    const row = logs[i];
    if (!row.groupId) {
      out.push({ kind: "flat", row });
      i += 1;
      continue;
    }
    const groupId = row.groupId;
    const rows: ActionLog[] = [];
    while (i < logs.length && logs[i].groupId === groupId) {
      rows.push(logs[i]);
      i += 1;
    }
    out.push(
      rows.length === 1
        ? { kind: "flat", row: rows[0] }
        : { kind: "batch", rows },
    );
  }
  return out;
}

// Aggregate child statuses into one summary the parent row pill renders.
// Priority: pending > failed > success/dry_run/grabbed/etc. (the worst
// outstanding state wins so the user sees "still working" or "needs
// attention" first).
function summaryStatus(rows: ActionLog[]): ActionStatus {
  if (rows.some((r) => r.status === "pending")) return "pending";
  if (rows.some((r) => r.status === "failed")) return "failed";
  if (rows.every((r) => r.status === "dry_run")) return "dry_run";
  return "success";
}

export function HistoryTable({ logs }: Props) {
  const tCols = useTranslations("history.columns");
  const tRetry = useTranslations("history.retry");
  const tBatch = useTranslations("history.batch");
  const tActions = useTranslations("history.actionLabels");

  const groups = useMemo(() => groupLogs(logs), [logs]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (groupId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{tCols("date")}</TableHead>
          <TableHead>{tCols("action")}</TableHead>
          <TableHead>{tCols("title")}</TableHead>
          <TableHead>{tCols("status")}</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.flatMap((g) =>
          g.kind === "flat"
            ? [renderFlat(g.row, tRetry)]
            : renderBatch(
                g.rows,
                expanded.has(g.rows[0].groupId!),
                () => toggle(g.rows[0].groupId!),
                tRetry,
                tBatch,
                tActions,
              ),
        )}
      </TableBody>
    </Table>
  );
}

type T = ReturnType<typeof useTranslations>;

function renderFlat(log: ActionLog, tRetry: T) {
  return (
    <TableRow key={log.id}>
      <TableCell
        className="text-muted-foreground text-xs whitespace-nowrap"
        title={new Date(log.createdAt).toLocaleString()}
      >
        {formatRelative(log.createdAt)}
        {log.lastRetriedAt && (
          <span
            className="text-muted-foreground/70 ml-1"
            title={new Date(log.lastRetriedAt).toLocaleString()}
          >
            ·{" "}
            {tRetry("retried", {
              time: formatRelative(log.lastRetriedAt),
            })}
          </span>
        )}
      </TableCell>
      <TableCell>
        <ActionTypeBadge action={log.action} />
      </TableCell>
      <TableCell className="text-sm">{log.title}</TableCell>
      <TableCell>
        <ActionStatusBadge status={log.status} />
      </TableCell>
      <TableCell>
        {log.status === "failed" && log.payload && (
          <RetryButton logId={log.id} title={log.title} />
        )}
      </TableCell>
    </TableRow>
  );
}

// Renders the parent + (optionally) the indented children. The parent
// is the first row's createdAt + a count summary; clicking it toggles
// child visibility. Per-child retry remains usable when expanded.
function renderBatch(
  rows: ActionLog[],
  isExpanded: boolean,
  onToggle: () => void,
  tRetry: T,
  tBatch: T,
  tActions: T,
): ReactElement[] {
  const groupId = rows[0].groupId!;
  const head = rows[0];
  const Chevron = isExpanded ? ChevronDown : ChevronRight;
  // Keyboard activation mirrors the click handler so non-mouse users
  // (Tab + Enter / Space) can toggle the batch open. role="button" +
  // tabIndex=0 expose the row to assistive tech as the actionable
  // element it is.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle();
    }
  };
  const out: ReactElement[] = [
    <TableRow
      key={`batch-${groupId}`}
      onClick={onToggle}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      aria-label={tBatch(isExpanded ? "collapse" : "expand")}
      className="bg-muted/30 hover:bg-muted/50 cursor-pointer"
    >
      <TableCell
        className="text-muted-foreground text-xs whitespace-nowrap"
        title={new Date(head.createdAt).toLocaleString()}
      >
        <span className="inline-flex items-center gap-1">
          <Chevron className="size-3" />
          {formatRelative(head.createdAt)}
        </span>
      </TableCell>
      <TableCell>
        <ActionTypeBadge action={head.action} />
      </TableCell>
      <TableCell className="text-sm font-medium">
        {tBatch("header", {
          action: tActions(head.action),
          count: rows.length,
        })}
      </TableCell>
      <TableCell>
        <ActionStatusBadge status={summaryStatus(rows)} />
      </TableCell>
      <TableCell />
    </TableRow>,
  ];
  if (isExpanded) {
    for (const r of rows) {
      out.push(
        <TableRow
          key={r.id}
          className="border-l-muted-foreground/30 border-l-2"
        >
          <TableCell
            className="text-muted-foreground pl-6 text-xs whitespace-nowrap"
            title={new Date(r.createdAt).toLocaleString()}
          >
            {formatRelative(r.createdAt)}
            {r.lastRetriedAt && (
              <span
                className="text-muted-foreground/70 ml-1"
                title={new Date(r.lastRetriedAt).toLocaleString()}
              >
                ·{" "}
                {tRetry("retried", {
                  time: formatRelative(r.lastRetriedAt),
                })}
              </span>
            )}
          </TableCell>
          <TableCell>
            <ActionTypeBadge action={r.action} />
          </TableCell>
          <TableCell className="text-sm">{r.title}</TableCell>
          <TableCell>
            <ActionStatusBadge status={r.status} />
          </TableCell>
          <TableCell>
            {r.status === "failed" && r.payload && (
              <RetryButton logId={r.id} title={r.title} />
            )}
          </TableCell>
        </TableRow>,
      );
    }
  }
  return out;
}
