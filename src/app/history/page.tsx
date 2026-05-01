"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/client/components/layout/AppShell";
import { HistoryTable } from "@/client/components/history/HistoryTable";
import { MediaTableSkeleton } from "@/client/components/media/MediaTableSkeleton";
import { EmptyLogs } from "@/client/components/states/EmptyLogs";
import { PageErrorBoundary } from "@/client/components/states/PageErrorBoundary";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/client/components/ui/select";
import { Label } from "@/client/components/ui/label";
import { useHistory } from "@/client/hooks/useHistory";
import { useInstances } from "@/client/hooks/useInstances";
import { useInfiniteScroll } from "@/client/hooks/useInfiniteScroll";
import type { ActionLog } from "@/shared/types/models";

function HistoryContent() {
  const searchParams = useSearchParams();
  const { data: instances } = useInstances();
  const [instanceId, setInstanceId] = useState<string>(
    searchParams.get("instanceId") ?? ""
  );
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [action, setAction] = useState("");

  const filters = {
    ...(instanceId ? { instanceId: Number(instanceId) } : {}),
    ...(status ? { status } : {}),
    ...(action ? { action } : {}),
  };

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useHistory(filters);
  const sentinelRef = useInfiniteScroll(fetchNextPage, !!hasNextPage);

  const allLogs: ActionLog[] = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <Label>Instance</Label>
          <Select value={instanceId} onValueChange={(v) => setInstanceId(v ?? "")}>
            <SelectTrigger className="w-40">
              <SelectValue>{instanceId ? (instances ?? []).find((i) => String(i.id) === instanceId)?.name ?? "All" : "All"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All</SelectItem>
              {(instances ?? []).map((i) => (
                <SelectItem key={i.id} value={String(i.id)}>{i.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v ?? "")}>
            <SelectTrigger className="w-36"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="dry_run">Dry Run</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label>Action</Label>
          <Select value={action} onValueChange={(v) => setAction(v ?? "")}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All</SelectItem>
              <SelectItem value="search">Search</SelectItem>
              <SelectItem value="delete">Delete</SelectItem>
              <SelectItem value="ignore">Ignore</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading && <MediaTableSkeleton />}
      {!isLoading && allLogs.length === 0 && <EmptyLogs />}
      {allLogs.length > 0 && <HistoryTable logs={allLogs} />}

      <div ref={sentinelRef} className="h-4" />
      {isFetchingNextPage && <MediaTableSkeleton rows={3} />}
    </div>
  );
}

export default function HistoryPage() {
  return (
    <AppShell>
      <PageErrorBoundary>
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">History</h1>
          <Suspense fallback={<MediaTableSkeleton />}>
            <HistoryContent />
          </Suspense>
        </div>
      </PageErrorBoundary>
    </AppShell>
  );
}
