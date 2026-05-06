"use client";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/client/components/ui/card";
import { useInstances } from "@/client/hooks/data/useInstances";
import { useAllPendingQueue } from "@/client/hooks/data/useSearchQueue";
import type { SearchQueueEntry } from "@/shared/types/models";
import { InstanceQueueSection } from "./InstanceQueueSection";

export function QueueContent() {
  const t = useTranslations("queue");
  const tCommon = useTranslations("common");
  const { data: queue, isLoading } = useAllPendingQueue();
  const { data: instances } = useInstances();
  const rows = queue?.items ?? [];

  if (isLoading) {
    return (
      <p className="text-muted-foreground text-sm">{tCommon("loading")}</p>
    );
  }
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-8 text-center text-sm">
          {t("empty")}
        </CardContent>
      </Card>
    );
  }

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
