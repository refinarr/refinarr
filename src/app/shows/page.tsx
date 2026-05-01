"use client";
import { AppShell } from "@/client/components/layout/AppShell";
import { BulkActionToolbar } from "@/client/components/media/BulkActionToolbar";
import { MediaTableSkeleton } from "@/client/components/media/MediaTableSkeleton";
import { MediaSearchBar } from "@/client/components/media/MediaSearchBar";
import { MediaTable, type ColumnDef } from "@/client/components/media/MediaTable";
import { ActiveFilterChips, type FilterChip } from "@/client/components/media/ActiveFilterChips";
import { SeverityDot } from "@/client/components/media/SeverityDot";
import { ScoreLabel } from "@/client/components/media/ScoreLabel";
import { CfBadge } from "@/client/components/media/CfBadge";
import { RowHoverActions } from "@/client/components/media/RowHoverActions";
import { AllClearState } from "@/client/components/states/AllClearState";
import { NoCfsPrompt } from "@/client/components/states/NoCfsPrompt";
import { NoInstancesPrompt } from "@/client/components/states/NoInstancesPrompt";
import { MediaErrorCard } from "@/client/components/states/MediaErrorCard";
import { PageErrorBoundary } from "@/client/components/states/PageErrorBoundary";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/client/components/ui/select";
import { SeriesDetailDrawer } from "@/client/components/shows/SeriesDetailDrawer";
import { useShowsPage } from "@/client/hooks/useShowsPage";
import { useQualityProfiles } from "@/client/hooks/useQualityProfiles";
import { usePreferences } from "@/client/hooks/usePreferences";
import { useCustomFormats } from "@/client/hooks/useCustomFormats";
import { getSeverity } from "@/client/lib/severity";
import type { FlaggedSeries } from "@/shared/types/models";
import { Loader2 } from "lucide-react";

export default function ShowsPage() {
  const {
    router, instances, loadingInstances, sonarrInstances,
    activeInstance, setInstanceId, selected, toggle,
    filters, setFilters, selectedId, setSelectedId, selectedItem,
    allSeries, total, isLoading, isError, isFetchingNextPage,
    refetch, sentinelRef, scoringMode, noCfsConfigured,
    handleSearch, handleIgnore, handleDelete, runSearch, runIgnore, runDelete,
  } = useShowsPage();

  const { data: profiles } = useQualityProfiles("sonarr", activeInstance);
  const { data: prefs } = usePreferences(activeInstance);
  const { data: cfs } = useCustomFormats("sonarr", activeInstance);
  const cfOptions = scoringMode === "manual"
    ? (prefs ?? []).map((p) => ({ id: p.cfId, name: p.cfName }))
    : (cfs ?? []);

  if (!loadingInstances && !instances?.length) {
    return (
      <AppShell>
        <NoInstancesPrompt onAdd={() => router.push("/settings")} />
      </AppShell>
    );
  }

  const columns: ColumnDef<FlaggedSeries>[] = [
    {
      key: "severity",
      header: "",
      className: "w-8",
      render: (s) => {
        const score = scoringMode === "profile" ? s.customFormatScore : s.cfScore;
        return <SeverityDot severity={getSeverity(score, s.minProfileScore, scoringMode)} />;
      },
    },
    {
      key: "title",
      header: "Title",
      sortKey: "title",
      render: (s) => (
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="font-medium truncate">{s.title}</span>
          <span className="text-muted-foreground text-xs shrink-0">{s.year}</span>
        </div>
      ),
    },
    {
      key: "profile",
      header: "Profile",
      className: "w-32 text-muted-foreground",
      render: (s) => (
        <span className="truncate text-xs">
          {profiles?.find((p) => p.id === s.qualityProfileId)?.name ?? "—"}
        </span>
      ),
    },
    {
      key: "score",
      header: "Score",
      sortKey: "score",
      className: "w-32",
      render: (s) => (
        <ScoreLabel
          score={scoringMode === "profile" ? s.customFormatScore : s.cfScore}
          minProfileScore={s.minProfileScore}
        />
      ),
    },
    {
      key: "episodes",
      header: "Eps",
      className: "w-20 text-xs text-muted-foreground tabular-nums",
      render: (s) => `${s.affectedEpisodeCount} / ${s.totalEpisodeCount}`,
    },
    {
      key: "missing",
      header: "Missing",
      render: (s) => (
        <div className="flex flex-wrap gap-1">
          {s.missingFormats.slice(0, 3).map((cf) => (
            <CfBadge key={cf.id} name={cf.name} missing />
          ))}
          {s.missingFormats.length > 3 && (
            <span className="text-xs text-muted-foreground">+{s.missingFormats.length - 3}</span>
          )}
        </div>
      ),
    },
  ];

  const profileName = profiles?.find((p) => p.id === filters.profileId)?.name;
  const cfName = cfOptions.find((c) => c.id === filters.missingCfId)?.name;

  const chips: FilterChip[] = [
    filters.q && {
      key: "q",
      label: `“${filters.q}”`,
      onRemove: () => setFilters((f) => ({ ...f, q: "" })),
    },
    filters.profileId !== null && profileName && {
      key: "profile",
      label: `Profile: ${profileName}`,
      onRemove: () => setFilters((f) => ({ ...f, profileId: null })),
    },
    filters.missingCfId !== null && cfName && {
      key: "cf",
      label: `Missing: ${cfName}`,
      onRemove: () => setFilters((f) => ({ ...f, missingCfId: null })),
    },
  ].filter(Boolean) as FilterChip[];

  return (
    <AppShell>
      <PageErrorBoundary>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Shows</h1>
              {!isLoading && (
                <p className="text-muted-foreground text-sm mt-1">
                  {total} flagged{selected.size > 0 ? ` · ${selected.size} selected` : ""}
                </p>
              )}
            </div>
            {sonarrInstances.length > 1 && (
              <Select value={String(activeInstance)} onValueChange={(v) => setInstanceId(Number(v ?? 0))}>
                <SelectTrigger className="w-44">
                  <SelectValue>
                    {sonarrInstances.find((i) => i.id === activeInstance)?.name ?? "Select instance"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {sonarrInstances.map((i) => (
                    <SelectItem key={i.id} value={String(i.id)}>{i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <MediaSearchBar
            arrType="sonarr"
            instanceId={activeInstance}
            scoringMode={scoringMode}
            filters={filters}
            onChange={(next) => setFilters((prev) => ({ ...prev, ...next }))}
          />

          <ActiveFilterChips chips={chips} />

          <BulkActionToolbar
            selectedCount={selected.size}
            onSearch={handleSearch}
            onDelete={handleDelete}
            onIgnore={handleIgnore}
          />

          {(isLoading || loadingInstances) && <MediaTableSkeleton rows={8} />}
          {isError && <MediaErrorCard onRetry={refetch} />}
          {!loadingInstances && !isLoading && !isError && allSeries.length === 0 && (
            activeInstance
              ? noCfsConfigured ? <NoCfsPrompt /> : <AllClearState />
              : <NoCfsPrompt />
          )}

          {!isLoading && allSeries.length > 0 && (
            <MediaTable
              rows={allSeries}
              columns={columns}
              selectedIds={selected}
              onToggleSelect={toggle}
              onRowClick={setSelectedId}
              sortBy={filters.sortBy}
              order={filters.order}
              onSortChange={(key) =>
                setFilters((f) => ({
                  ...f,
                  sortBy: key,
                  order: f.sortBy === key && f.order === "asc" ? "desc" : "asc",
                }))
              }
              rowActions={(s) => (
                <RowHoverActions
                  onSearch={() => runSearch([s])}
                  onIgnore={async () => { await runIgnore([s]); }}
                />
              )}
            />
          )}

          <div ref={sentinelRef} className="h-4" />
          {isFetchingNextPage && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        <SeriesDetailDrawer
          series={selectedItem}
          open={selectedId !== null}
          onOpenChange={(open) => !open && setSelectedId(null)}
          scoringMode={scoringMode}
          onSearch={async (s) => { await runSearch([s]); setSelectedId(null); }}
          onIgnore={async (s) => { await runIgnore([s]); setSelectedId(null); }}
          onDelete={async (s, triggerSearch) => {
            if (!confirm(`Delete all files for "${s.title}"? This cannot be undone.`)) return;
            await runDelete([s], triggerSearch);
            setSelectedId(null);
          }}
        />
      </PageErrorBoundary>
    </AppShell>
  );
}
