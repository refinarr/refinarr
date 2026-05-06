"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { AppShell } from "@/client/components/layout/AppShell";
import { HistoryTable } from "@/client/components/history/HistoryTable";
import { MediaTableSkeleton } from "@/client/components/media/MediaTableSkeleton";
import { EmptyLogs } from "@/client/components/states/EmptyLogs";
import { PageErrorBoundary } from "@/client/components/states/PageErrorBoundary";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import { Label } from "@/client/components/ui/label";
import { Button } from "@/client/components/ui/button";
import { useHistory, useClearHistory } from "@/client/hooks/data/useHistory";
import { useInstances } from "@/client/hooks/data/useInstances";
import { useInfiniteScroll } from "@/client/hooks/ui/useInfiniteScroll";
import { useConfirm } from "@/client/hooks/ui/useConfirm";
import { withToast } from "@/client/lib/with-toast";
import type { ActionLog } from "@/shared/types/models";

function HistoryContent() {
  const t = useTranslations("history");
  const tStatus = useTranslations("history.statusLabels");
  const tAction = useTranslations("history.actionLabels");
  const tCommon = useTranslations("common");
  const tToast = useTranslations("toast.history");
  const tConfirm = useTranslations("confirm.clearHistory");
  const searchParams = useSearchParams();
  const { data: instances } = useInstances();
  const [instanceId, setInstanceId] = useState<string>(
    searchParams.get("instanceId") ?? "",
  );
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [action, setAction] = useState("");

  const filters = {
    ...(instanceId ? { instanceId: Number(instanceId) } : {}),
    ...(status ? { status } : {}),
    ...(action ? { action } : {}),
  };

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useHistory(filters);
  const sentinelRef = useInfiniteScroll(fetchNextPage, !!hasNextPage);
  const clear = useClearHistory();
  const { confirm: askConfirm, dialog: confirmDialog } = useConfirm();
  const runClear = withToast(clear, {
    success: tToast("cleared"),
    error: tToast("clearFailed"),
  });
  const handleClear = async () => {
    if (
      await askConfirm({
        title: tConfirm("title"),
        body: tConfirm("body"),
        confirmLabel: t("clear"),
        destructive: true,
      })
    )
      runClear(undefined);
  };

  const allLogs: ActionLog[] = data?.pages.flatMap((p) => p.items) ?? [];

  const statusLabel = (key: string) => {
    switch (key) {
      case "success":
        return tStatus("success");
      case "failed":
        return tStatus("failed");
      case "dry_run":
        return tStatus("dryRun");
      case "pending":
        return tStatus("pending");
      default:
        return tCommon("all");
    }
  };

  const actionLabel = (key: string) => {
    switch (key) {
      case "search":
        return tAction("search");
      case "search_season":
        return tAction("search_season");
      case "search_episode":
        return tAction("search_episode");
      case "delete":
        return tAction("delete");
      case "ignore":
        return tAction("ignore");
      default:
        return tCommon("all");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-col gap-1">
          <Label>{t("filters.instance")}</Label>
          <Select
            value={instanceId}
            onValueChange={(v) => setInstanceId(v ?? "")}
          >
            <SelectTrigger className="w-40">
              <SelectValue>
                {instanceId
                  ? ((instances ?? []).find((i) => String(i.id) === instanceId)
                      ?.name ?? tCommon("all"))
                  : tCommon("all")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{tCommon("all")}</SelectItem>
              {(instances ?? []).map((i) => (
                <SelectItem key={i.id} value={String(i.id)}>
                  {i.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label>{t("filters.status")}</Label>
          <Select value={status} onValueChange={(v) => setStatus(v ?? "")}>
            <SelectTrigger className="w-36">
              <SelectValue>{statusLabel(status)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{tCommon("all")}</SelectItem>
              <SelectItem value="success">{tStatus("success")}</SelectItem>
              <SelectItem value="failed">{tStatus("failed")}</SelectItem>
              <SelectItem value="dry_run">{tStatus("dryRun")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label>{t("filters.action")}</Label>
          <Select value={action} onValueChange={(v) => setAction(v ?? "")}>
            <SelectTrigger className="w-40">
              <SelectValue>{actionLabel(action)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{tCommon("all")}</SelectItem>
              <SelectItem value="search">{tAction("search")}</SelectItem>
              <SelectItem value="search_season">
                {tAction("search_season")}
              </SelectItem>
              <SelectItem value="search_episode">
                {tAction("search_episode")}
              </SelectItem>
              <SelectItem value="delete">{tAction("delete")}</SelectItem>
              <SelectItem value="ignore">{tAction("ignore")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto self-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={clear.isPending || allLogs.length === 0}
          >
            <Trash2 className="text-destructive mr-1 size-4" /> {t("clear")}
          </Button>
        </div>
      </div>

      {isLoading && <MediaTableSkeleton />}
      {!isLoading && allLogs.length === 0 && <EmptyLogs />}
      {allLogs.length > 0 && <HistoryTable logs={allLogs} />}

      <div ref={sentinelRef} className="h-4" />
      {isFetchingNextPage && <MediaTableSkeleton rows={3} />}
      {confirmDialog}
    </div>
  );
}

export default function HistoryPage() {
  const t = useTranslations("history");
  return (
    <AppShell>
      <PageErrorBoundary>
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <Suspense fallback={<MediaTableSkeleton />}>
            <HistoryContent />
          </Suspense>
        </div>
      </PageErrorBoundary>
    </AppShell>
  );
}
