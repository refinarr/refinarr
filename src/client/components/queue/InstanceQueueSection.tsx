"use client";
import { useTranslations } from "next-intl";
import { Hourglass, Trash2 } from "lucide-react";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import {
  useSearchQueue,
  useClearQueue,
} from "@/client/hooks/data/useSearchQueue";
import { useConfirm } from "@/client/hooks/ui/useConfirm";
import { formatEta, formatRelative } from "@/client/lib/format-relative";
import { withToast } from "@/client/lib/with-toast";
import type {
  SearchQueueAction,
  SearchQueueEntry,
} from "@/shared/types/models";

interface Props {
  instanceId: number;
  instanceName: string;
  rows: SearchQueueEntry[];
}

export function InstanceQueueSection({
  instanceId,
  instanceName,
  rows,
}: Props) {
  const t = useTranslations("queue");
  const tTime = useTranslations("time");
  const { data: status } = useSearchQueue(instanceId);
  const clear = useClearQueue();
  const { confirm: askConfirm, dialog: confirmDialog } = useConfirm();

  const runClear = withToast(clear, {
    success: t("clearedToast", { count: rows.length }),
    error: t("clearFailedToast"),
  });

  const handleClear = async () => {
    const ok = await askConfirm({
      title: t("clearConfirmTitle"),
      body: t("clearConfirmBody", {
        count: rows.length,
        instance: instanceName,
      }),
      confirmLabel: t("clear"),
      destructive: true,
    });
    if (ok) await runClear(instanceId);
  };

  const actionLabel = (action: SearchQueueAction): string => {
    switch (action) {
      case "movie":
        return t("actionMovie");
      case "series":
        return t("actionSeries");
      case "season":
        return t("actionSeason");
      case "episode":
        return t("actionEpisode");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <CardTitle className="flex items-center gap-2">
            <Hourglass className="size-4" />
            {instanceName}
            <Badge variant="outline">
              {t("pendingCount", { count: rows.length })}
            </Badge>
          </CardTitle>
          <p className="text-muted-foreground text-xs">
            {status && status.etaMs > 0
              ? t("etaLabel", { eta: formatEta(status.etaMs, tTime) })
              : t("etaNone")}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          disabled={clear.isPending || rows.length === 0}
          aria-label={t("clear")}
        >
          <Trash2 className="text-destructive mr-1 size-4" />
          {t("clear")}
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="divide-border divide-y">
          {rows.map((row, idx) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-4 py-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium" title={row.title}>
                  {row.title}
                </p>
                <p className="text-muted-foreground text-xs">
                  {actionLabel(row.action)} ·{" "}
                  {t("queuedAt", {
                    time: formatRelative(row.createdAt, tTime),
                  })}
                </p>
              </div>
              <Badge variant="outline" className="text-xs">
                #{idx + 1}
              </Badge>
            </li>
          ))}
        </ul>
      </CardContent>
      {confirmDialog}
    </Card>
  );
}
