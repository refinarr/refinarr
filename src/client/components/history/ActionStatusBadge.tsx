"use client";
import { useTranslations } from "next-intl";
import { Badge } from "@/client/components/ui/badge";
import type { ActionStatus } from "@/shared/types/models";

const classes: Record<ActionStatus, string> = {
  // success = terminal "done" for delete/ignore actions.
  success: "bg-ok-soft text-ok border-ok/30",
  // searched = search command queued upstream, pre-lifecycle. Neutral
  // styling so it doesn't read as "we're done" — the row will move to
  // grabbed/downloaded (or failed) once the statusPoller observes the
  // upstream outcome.
  searched: "bg-neutral-soft text-neutral-foreground border-border",
  dry_run: "bg-info-soft text-info border-info/30",
  failed: "bg-critical-soft text-critical border-critical/30",
  pending: "bg-neutral-soft text-neutral-foreground border-border",
  // grabbed = release fetched, downloading. Brand-tinted to read as
  // "in progress, going well" without competing with success/ok green.
  grabbed: "bg-info-soft text-info border-info/30",
  // downloaded = imported into the library. Solid ok styling — this
  // is the terminal happy state for a search action.
  downloaded: "bg-ok-soft text-ok border-ok/30 font-medium",
};

const labelKeys: Record<
  ActionStatus,
  | "success"
  | "searched"
  | "dryRun"
  | "failed"
  | "pending"
  | "grabbed"
  | "downloaded"
> = {
  success: "success",
  searched: "searched",
  dry_run: "dryRun",
  failed: "failed",
  pending: "pending",
  grabbed: "grabbed",
  downloaded: "downloaded",
};

interface Props {
  status: ActionStatus;
  // Optional prefix used by batch-parent rows to show "N Downloaded"
  // instead of a bare label. Flat rows omit it — 1 item is implicit.
  count?: number;
}

export function ActionStatusBadge({ status, count }: Props) {
  const t = useTranslations("history.statusLabels");
  const label = t(labelKeys[status]);
  return (
    <Badge variant="outline" className={classes[status]}>
      {count !== undefined ? `${count} ${label}` : label}
    </Badge>
  );
}
