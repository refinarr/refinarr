"use client";
import { useTranslations } from "next-intl";
import { AppShell } from "@/client/components/layout/AppShell";
import { PageErrorBoundary } from "@/client/components/states/PageErrorBoundary";
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Trash2, Hourglass } from "lucide-react";
import { useAllPendingQueue, useClearQueue, useSearchQueue } from "@/client/hooks/data/useSearchQueue";
import { useInstances } from "@/client/hooks/data/useInstances";
import { useConfirm } from "@/client/hooks/ui/useConfirm";
import { withToast } from "@/client/lib/with-toast";
import { formatEta, formatRelative } from "@/client/lib/format-relative";
import type { SearchQueueAction, SearchQueueEntry } from "@/shared/types/models";

interface InstanceSectionProps {
  instanceId: number;
  instanceName: string;
  rows: SearchQueueEntry[];
}

function InstanceQueueSection({ instanceId, instanceName, rows }: InstanceSectionProps) {
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
    if (await askConfirm({
      title: t("clearConfirmTitle"),
      body: t("clearConfirmBody", { count: rows.length, instance: instanceName }),
      confirmLabel: t("clear"),
      destructive: true,
    })) await runClear(instanceId);
  };

  const actionLabel = (a: SearchQueueAction): string => {
    switch (a) {
      case "movie": return t("actionMovie");
      case "series": return t("actionSeries");
      case "season": return t("actionSeason");
      case "episode-file": return t("actionEpisodeFile");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <CardTitle className="flex items-center gap-2">
            <Hourglass className="h-4 w-4" />
            {instanceName}
            <Badge variant="outline">{t("pendingCount", { count: rows.length })}</Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
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
          <Trash2 className="h-4 w-4 mr-1 text-destructive" />
          {t("clear")}
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="divide-y divide-border">
          {rows.map((row, idx) => (
            <li key={row.id} className="flex items-center justify-between gap-4 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate" title={row.title}>{row.title}</p>
                <p className="text-xs text-muted-foreground">
                  {actionLabel(row.action)} · {t("queuedAt", { time: formatRelative(row.createdAt, tTime) })}
                </p>
              </div>
              <Badge variant="outline" className="text-xs">#{idx + 1}</Badge>
            </li>
          ))}
        </ul>
      </CardContent>
      {confirmDialog}
    </Card>
  );
}

function QueueContent() {
  const t = useTranslations("queue");
  const { data: queue, isLoading } = useAllPendingQueue();
  const { data: instances } = useInstances();
  const rows = queue?.items ?? [];

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">…</p>;
  }
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          {t("empty")}
        </CardContent>
      </Card>
    );
  }

  // Group rows by instanceId.
  const byInstance = new Map<number, SearchQueueEntry[]>();
  for (const row of rows) {
    const list = byInstance.get(row.instanceId) ?? [];
    list.push(row);
    byInstance.set(row.instanceId, list);
  }

  return (
    <div className="flex flex-col gap-4">
      {[...byInstance.entries()].map(([instanceId, group]) => {
        const inst = (instances ?? []).find((i) => i.id === instanceId);
        return (
          <InstanceQueueSection
            key={instanceId}
            instanceId={instanceId}
            instanceName={inst?.name ?? `#${instanceId}`}
            rows={group}
          />
        );
      })}
    </div>
  );
}

export default function QueuePage() {
  const t = useTranslations("queue");
  return (
    <AppShell>
      <PageErrorBoundary>
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold">{t("title")}</h1>
            <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>
          <QueueContent />
        </div>
      </PageErrorBoundary>
    </AppShell>
  );
}
