"use client";
import { useTranslations } from "next-intl";
import { Badge } from "@/client/components/ui/badge";
import type { ActionStatus } from "@/shared/types/models";

const classes: Record<ActionStatus, string> = {
  success: "bg-ok-soft text-ok border-ok/30",
  dry_run: "bg-info-soft text-info border-info/30",
  failed: "bg-critical-soft text-critical border-critical/30",
  pending: "bg-neutral-soft text-neutral-foreground border-border",
};

const labelKeys: Record<
  ActionStatus,
  "success" | "dryRun" | "failed" | "pending"
> = {
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
  return (
    <Badge variant="outline" className={classes[status]}>
      {t(labelKeys[status])}
    </Badge>
  );
}
