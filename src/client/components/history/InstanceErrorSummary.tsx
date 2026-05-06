"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Badge } from "@/client/components/ui/badge";
import { useHistoryErrors } from "@/client/hooks/data/useHistory";

interface Props {
  instanceId: number;
}

export function InstanceErrorSummary({ instanceId }: Props) {
  const tStatus = useTranslations("history.statusLabels");
  const { data: errors } = useHistoryErrors(instanceId);
  const count = errors?.length ?? 0;
  if (count === 0) return null;

  return (
    <Link
      href={`/history?instanceId=${instanceId}&status=failed`}
      className="flex items-center gap-1"
    >
      <Badge variant="destructive">{count}</Badge>
      <span className="text-muted-foreground text-xs">{tStatus("failed")}</span>
    </Link>
  );
}
