"use client";
import { Badge } from "@/client/components/ui/badge";
import type { ActionStatus } from "@/shared/types/models";

const labels: Record<ActionStatus, string> = {
  success: "Success",
  dry_run: "Dry Run",
  failed: "Failed",
  pending: "Pending",
};

const classes: Record<ActionStatus, string> = {
  success: "bg-green-950 text-green-300 border-green-800",
  dry_run: "bg-purple-950 text-purple-300 border-purple-800",
  failed: "bg-red-950 text-red-300 border-red-800",
  pending: "bg-slate-700/40 text-slate-300 border-slate-600",
};

interface Props {
  status: ActionStatus;
}

export function ActionStatusBadge({ status }: Props) {
  return <Badge variant="outline" className={classes[status]}>{labels[status]}</Badge>;
}
