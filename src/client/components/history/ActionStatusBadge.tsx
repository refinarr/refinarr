"use client";
import { useTranslations } from "next-intl";
import { Badge } from "@/client/components/ui/badge";
import type { ActionStatus } from "@/shared/types/models";

const classes: Record<ActionStatus, string> = {
  success: "bg-green-950 text-green-300 border-green-800",
  dry_run: "bg-purple-950 text-purple-300 border-purple-800",
  failed: "bg-red-950 text-red-300 border-red-800",
  pending: "bg-slate-700/40 text-slate-300 border-slate-600",
};

const labelKeys: Record<ActionStatus, "success" | "dryRun" | "failed" | "pending"> = {
  success: "success",
  dry_run: "dryRun",
  failed: "failed",
  pending: "pending",
};

interface Props {
  status: ActionStatus;
}

export function ActionStatusBadge({ status }: Props) {
  const t = useTranslations("history.statusLabels");
  return <Badge variant="outline" className={classes[status]}>{t(labelKeys[status])}</Badge>;
}
