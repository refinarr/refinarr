"use client";
import type { ReactElement } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
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
import { mediaFocusPath } from "@/client/lib/media-link";
import { useInstances } from "@/client/hooks/data/useInstances";
import type { ActionLog, ActionStatus, ArrType } from "@/shared/types/models";
import type { GroupSummary } from "@/shared/types/api";
import { ActionStatusBadge } from "./ActionStatusBadge";
import { ActionTypeBadge } from "./ActionTypeBadge";
import { RetryButton } from "./RetryButton";

interface Props {
  logs: ActionLog[];
  // Server-side aggregate per groupId. When present, the batch parent
  // row uses these counts instead of the per-page row count — so a 100-
  // item batch spanning paginated pages shows the true total. Optional
  // for backward compat with callers that don't paginate.
  groupSummaries?: Record<string, GroupSummary>;
}

// Output of `groupLogs`. A group with a single child OR a null groupId
// renders flat (current behavior). A group with >1 children renders a
// parent header row above the indented children, default-collapsed so a
// large bulk action doesn't blow up the page.
type Group =
  | { kind: "flat"; row: ActionLog }
  | { kind: "batch"; rows: ActionLog[] };

// Bucket rows by groupId — NOT by adjacency. Logs come in createdAt-desc
// order, but the search worker drains queues round-robin across
// instances, so two batches submitted close together can produce
// interleaved ActionLog rows by createdAt. A linear adjacency scan
// would shatter each batch into solo flat rows. Bucketing by groupId
// keeps siblings together regardless of where their createdAt lands.
//
// The display position of a batch is anchored to its FIRST-encountered
// row (the most recent child), so batches and flat rows still
// interleave chronologically by their head-row timestamp.
//
// A 1-row "group" renders flat — the bulk client only stamps a groupId
// on submissions of >1 items, and pending queue rows are synthesized
// into the history feed at the API layer so all N siblings of a batch
// are visible from the moment of submit. By the time a 1-row group
// reaches us, it's a genuinely solo entry.
function groupLogs(logs: ActionLog[]): Group[] {
  // First pass: emit Groups in input order. Same-groupId rows pile
  // into a shared `rows` array reference; subsequent encounters skip
  // pushing a new Group and just append to the existing array.
  const out: Group[] = [];
  const seen = new Map<string, ActionLog[]>();
  for (const row of logs) {
    if (!row.groupId) {
      out.push({ kind: "flat", row });
      continue;
    }
    const existing = seen.get(row.groupId);
    if (existing) {
      existing.push(row);
      continue;
    }
    const rows: ActionLog[] = [row];
    seen.set(row.groupId, rows);
    out.push({ kind: "batch", rows });
  }
  // Collapse any 1-row "batch" to flat now that all rows have landed.
  return out.map((g) =>
    g.kind === "batch" && g.rows.length === 1
      ? { kind: "flat", row: g.rows[0] }
      : g,
  );
}

// Display order for the per-status count badges on batch parent rows.
// Reads as the lifecycle from "needs attention / still working" on the
// left to "done" on the right, so a glance left-to-right tells the
// user "what's outstanding, what's complete." Mirrors the conceptual
// ordering used in /history's status filter dropdown.
const STATUS_DISPLAY_ORDER: ActionStatus[] = [
  "pending",
  "failed",
  "dry_run",
  "searched",
  "grabbed",
  "downloaded",
  "success",
];

// Aggregate child statuses into a count-per-status array used by the
// batch-parent row to render one mini-badge per state present, e.g.
// [1 Failed] [2 Searched] [1 Downloaded]. Replaces the old
// "single-summary-badge" approach which had to compromise between
// "show worst" (hid progress) and "show most-advanced" (hid problems);
// the count list shows BOTH at the cost of a few extra pixels.
function statusCounts(
  rows: ActionLog[],
): Array<{ status: ActionStatus; count: number }> {
  const counts = new Map<ActionStatus, number>();
  for (const r of rows) {
    counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
  }
  return STATUS_DISPLAY_ORDER.filter((s) => counts.has(s)).map((status) => ({
    status,
    count: counts.get(status) as number,
  }));
}

export function HistoryTable({ logs, groupSummaries }: Props) {
  const tCols = useTranslations("history.columns");
  const tRetry = useTranslations("history.retry");
  const tBatch = useTranslations("history.batch");
  const tActions = useTranslations("history.actionLabels");
  const { data: instances } = useInstances();

  const instanceTypeMap = useMemo(() => {
    const map = new Map<number, ArrType>();
    for (const i of instances ?? []) map.set(i.id, i.type);
    return map;
  }, [instances]);

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
            ? [renderFlat(g.row, tRetry, instanceTypeMap)]
            : renderBatch(
                g.rows,
                expanded.has(g.rows[0].groupId!),
                () => toggle(g.rows[0].groupId!),
                tRetry,
                tBatch,
                tActions,
                groupSummaries?.[g.rows[0].groupId!],
                instanceTypeMap,
              ),
        )}
      </TableBody>
    </Table>
  );
}

type T = ReturnType<typeof useTranslations>;
type InstanceTypeMap = Map<number, ArrType>;

// Title cell that becomes a Link when we know the instance's arr-type
// (always, in practice — instances load before history). The link
// points at /movies?focus=ID or /shows?focus=ID; the media-list page
// reads the param and scrolls + highlights the row.
function TitleCell({
  log,
  instanceTypeMap,
}: {
  log: ActionLog;
  instanceTypeMap: InstanceTypeMap;
}) {
  const t = useTranslations("history");
  const instanceType = instanceTypeMap.get(log.instanceId);
  const titleNode = instanceType ? (
    <Link
      href={mediaFocusPath({
        instanceType,
        instanceId: log.instanceId,
        mediaId: log.mediaId,
      })}
      className="hover:text-brand hover:underline"
    >
      {log.title}
    </Link>
  ) : (
    log.title
  );
  return (
    <>
      {titleNode}
      {log.completionMessage && (
        <span className="text-muted-foreground/80 ml-1.5 text-xs italic">
          · {log.completionMessage}
        </span>
      )}
      {log.sourceTitle && (
        <div
          className="text-muted-foreground truncate text-xs"
          title={log.sourceTitle}
        >
          {t("grabbedRelease", { title: log.sourceTitle })}
        </div>
      )}
    </>
  );
}

function renderFlat(
  log: ActionLog,
  tRetry: T,
  instanceTypeMap: InstanceTypeMap,
) {
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
      <TableCell className="text-sm">
        <TitleCell log={log} instanceTypeMap={instanceTypeMap} />
      </TableCell>
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
  // When present (paginated /api/history response), these aggregates win
  // over the per-page `rows.length`/`statusCounts(rows)` calculations so
  // a batch spanning pages reads as one batch with the true total.
  summary: GroupSummary | undefined,
  instanceTypeMap: InstanceTypeMap,
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
          count: summary?.total ?? rows.length,
        })}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {(summary
            ? STATUS_DISPLAY_ORDER.filter(
                (s) => (summary.statusCounts[s] ?? 0) > 0,
              ).map((status) => ({
                status,
                count: summary.statusCounts[status] as number,
              }))
            : statusCounts(rows)
          ).map(({ status, count }) => (
            <ActionStatusBadge key={status} status={status} count={count} />
          ))}
        </div>
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
          <TableCell className="text-sm">
            <TitleCell log={r} instanceTypeMap={instanceTypeMap} />
          </TableCell>
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
