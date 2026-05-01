"use client";
import { useState } from "react";
import { AppShell } from "@/client/components/layout/AppShell";
import { FilterBar } from "@/client/components/media/FilterBar";
import { BulkActionToolbar } from "@/client/components/media/BulkActionToolbar";
import { MediaTableSkeleton } from "@/client/components/media/MediaTableSkeleton";
import { CfBadge } from "@/client/components/media/CfBadge";
import { AllClearState } from "@/client/components/states/AllClearState";
import { NoCfsPrompt } from "@/client/components/states/NoCfsPrompt";
import { NoInstancesPrompt } from "@/client/components/states/NoInstancesPrompt";
import { MediaErrorCard } from "@/client/components/states/MediaErrorCard";
import { PageErrorBoundary } from "@/client/components/states/PageErrorBoundary";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/client/components/ui/table";
import { Checkbox } from "@/client/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/client/components/ui/select";
import { useInstances } from "@/client/hooks/useInstances";
import { useSeries } from "@/client/hooks/useSeries";
import { useDebouncedValue } from "@/client/hooks/useDebouncedValue";
import { useConfig } from "@/client/hooks/useConfig";
import { usePreferences } from "@/client/hooks/usePreferences";
import { useInfiniteScroll } from "@/client/hooks/useInfiniteScroll";
import { api } from "@/client/lib/api";
import { toast } from "sonner";
import type { FlaggedSeries } from "@/shared/types/models";
import { useRouter } from "next/navigation";

export default function ShowsPage() {
  const router = useRouter();
  const { data: instances, isLoading: loadingInstances } = useInstances();
  const [instanceId, setInstanceId] = useState<number>(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [filters, setFilters] = useState<{ sortBy: "score" | "title" | "added"; order: "asc" | "desc"; maxScore: number }>({ sortBy: "score", order: "asc", maxScore: 1 });

  const activeInstance = instanceId || instances?.find((i) => i.type === "sonarr")?.id || 0;
  const debouncedMaxScore = useDebouncedValue(filters.maxScore, 400);
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, refetch } =
    useSeries(activeInstance, { ...filters, maxScore: debouncedMaxScore });
  const { data: config } = useConfig();
  const { data: prefs } = usePreferences(activeInstance);
  const scoringMode = config?.scoringModes[`scoringMode:${activeInstance}`] ?? "manual";
  const noCfsConfigured = scoringMode === "manual" && (prefs?.length ?? 0) === 0;

  const sentinelRef = useInfiniteScroll(fetchNextPage, !!hasNextPage);

  const allSeries: FlaggedSeries[] = data?.pages.flatMap((p) => p.items) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectedSeries = allSeries.filter((s) => selected.has(s.id));

  const handleSearch = async () => {
    for (const s of selectedSeries) {
      await api.post(`/sonarr/series/search`, { instanceId: activeInstance, mediaId: s.id, title: s.title });
    }
    toast.success("Search triggered");
    setSelected(new Set());
  };

  const handleIgnore = async () => {
    for (const s of selectedSeries) {
      await api.post(`/ignore`, { instanceId: activeInstance, mediaId: s.id, mediaType: "series", title: s.title });
    }
    toast.success("Items ignored");
    setSelected(new Set());
    refetch();
  };

  if (!loadingInstances && !instances?.length) {
    return (
      <AppShell>
        <NoInstancesPrompt onAdd={() => router.push("/settings")} />
      </AppShell>
    );
  }

  const sonarrInstances = instances?.filter((i) => i.type === "sonarr") ?? [];

  return (
    <AppShell>
      <PageErrorBoundary>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Shows</h1>
              {!isLoading && <p className="text-muted-foreground text-sm mt-1">{total} flagged</p>}
            </div>
            {sonarrInstances.length > 1 && (
              <Select value={String(activeInstance)} onValueChange={(v) => setInstanceId(Number(v ?? 0))}>
                <SelectTrigger className="w-44">
                  <SelectValue>{sonarrInstances.find((i) => i.id === activeInstance)?.name ?? "Select instance"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {sonarrInstances.map((i) => (
                    <SelectItem key={i.id} value={String(i.id)}>{i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <FilterBar filters={filters} onChange={(f) => setFilters((prev) => ({ ...prev, ...f }))} />

          <BulkActionToolbar
            selectedCount={selected.size}
            onSearch={handleSearch}
            onDelete={() => toast.error("Delete: not supported for series")}
            onIgnore={handleIgnore}
          />

          {(isLoading || loadingInstances) && <MediaTableSkeleton />}
          {isError && <MediaErrorCard onRetry={refetch} />}
          {!loadingInstances && !isLoading && !isError && allSeries.length === 0 && (
            activeInstance
              ? noCfsConfigured ? <NoCfsPrompt /> : <AllClearState />
              : <NoCfsPrompt />
          )}

          {!isLoading && allSeries.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Title</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Missing CFs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allSeries.map((series) => (
                  <TableRow key={series.id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(series.id)}
                        onCheckedChange={() => toggle(series.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{series.title}</TableCell>
                    <TableCell className="text-muted-foreground">{series.year}</TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {series.minProfileScore !== undefined
                        ? `${series.customFormatScore} / ${series.minProfileScore}`
                        : `${Math.round(series.cfScore * 100)}%`}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {series.missingFormats.map((cf) => (
                          <CfBadge key={cf.id} name={cf.name} missing />
                        ))}
                      </div>
                      {series.totalEpisodeCount > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {series.affectedEpisodeCount} / {series.totalEpisodeCount} episodes
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div ref={sentinelRef} className="h-4" />
          {isFetchingNextPage && <MediaTableSkeleton rows={3} />}
        </div>
      </PageErrorBoundary>
    </AppShell>
  );
}
