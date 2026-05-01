"use client";
import { Badge } from "@/client/components/ui/badge";
import type { ActionStatus } from "@/shared/types/models";

const variants: Record<ActionStatus, "default" | "secondary" | "destructive" | "outline"> = {
  success: "default",
  dry_run: "secondary",
  failed: "destructive",
  pending: "outline",
};

const labels: Record<ActionStatus, string> = {
  success: "Success",
  dry_run: "Dry Run",
  failed: "Failed",
  pending: "Pending",
};

interface Props {
  status: ActionStatus;
}

export function ActionStatusBadge({ status }: Props) {
  return <Badge variant={variants[status]}>{labels[status]}</Badge>;
}
