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
import { MovieDetailDrawer } from "@/client/components/movies/MovieDetailDrawer";
import { useMoviesPage } from "@/client/hooks/useMoviesPage";
import { useQualityProfiles } from "@/client/hooks/useQualityProfiles";
import { usePreferences } from "@/client/hooks/usePreferences";
import { useCustomFormats } from "@/client/hooks/useCustomFormats";
import { getSeverity } from "@/client/lib/severity";
import type { FlaggedMovie } from "@/shared/types/models";
import { Loader2 } from "lucide-react";

export default function MoviesPage() {
  const {
    router, instances, loadingInstances, radarrInstances,
    activeInstance, setInstanceId, selected, toggle,
    filters, setFilters, selectedId, setSelectedId, selectedItem,
    allMovies, total, isLoading, isError, isFetchingNextPage,
    refetch, sentinelRef, scoringMode, noCfsConfigured,
    handleSearch, handleIgnore, handleDelete, runSearch, runIgnore, runDelete,
  } = useMoviesPage();

  const { data: profiles } = useQualityProfiles("radarr", activeInstance);
  const { data: prefs } = usePreferences(activeInstance);
  const { data: cfs } = useCustomFormats("radarr", activeInstance);
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

  const columns: ColumnDef<FlaggedMovie>[] = [
    {
      key: "severity",
      header: "",
      className: "w-8",
      render: (m) => {
        const score = scoringMode === "profile" ? m.customFormatScore : m.cfScore;
        return <SeverityDot severity={getSeverity(score, m.minProfileScore, scoringMode)} />;
      },
    },
    {
      key: "title",
      header: "Title",
      sortKey: "title",
      render: (m) => (
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="font-medium truncate">{m.title}</span>
          <span className="text-muted-foreground text-xs shrink-0">{m.year}</span>
        </div>
      ),
    },
    {
      key: "profile",
      header: "Profile",
      className: "w-36 text-muted-foreground",
      render: (m) => (
        <span className="truncate text-xs">
          {profiles?.find((p) => p.id === m.qualityProfileId)?.name ?? "—"}
        </span>
      ),
    },
    {
      key: "score",
      header: "Score",
      sortKey: "score",
      className: "w-32",
      render: (m) => (
        <ScoreLabel
          score={scoringMode === "profile" ? m.customFormatScore : m.cfScore}
          minProfileScore={m.minProfileScore}
        />
      ),
    },
    {
      key: "missing",
      header: "Missing",
      render: (m) => (
        <div className="flex flex-wrap gap-1">
          {m.missingFormats.slice(0, 3).map((cf) => (
            <CfBadge key={cf.id} name={cf.name} missing />
          ))}
          {m.missingFormats.length > 3 && (
            <span className="text-xs text-muted-foreground">+{m.missingFormats.length - 3}</span>
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
              <h1 className="text-2xl font-bold">Movies</h1>
              {!isLoading && (
                <p className="text-muted-foreground text-sm mt-1">
                  {total} flagged{selected.size > 0 ? ` · ${selected.size} selected` : ""}
                </p>
              )}
            </div>
            {radarrInstances.length > 1 && (
              <Select value={String(activeInstance)} onValueChange={(v) => setInstanceId(Number(v ?? 0))}>
                <SelectTrigger className="w-44">
                  <SelectValue>
                    {radarrInstances.find((i) => i.id === activeInstance)?.name ?? "Select instance"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {radarrInstances.map((i) => (
                    <SelectItem key={i.id} value={String(i.id)}>{i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <MediaSearchBar
            arrType="radarr"
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

          {(isLoading || loadingInstances) && <MediaTableSkeleton />}
          {isError && <MediaErrorCard onRetry={refetch} />}
          {!loadingInstances && !isLoading && !isError && allMovies.length === 0 && (
            activeInstance
              ? noCfsConfigured ? <NoCfsPrompt /> : <AllClearState />
              : <NoCfsPrompt />
          )}

          {!isLoading && allMovies.length > 0 && (
            <MediaTable
              rows={allMovies}
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
              rowActions={(m) => (
                <RowHoverActions
                  onSearch={() => runSearch([m])}
                  onIgnore={async () => { await runIgnore([m]); }}
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

        <MovieDetailDrawer
          movie={selectedItem}
          open={selectedId !== null}
          onOpenChange={(open) => !open && setSelectedId(null)}
          scoringMode={scoringMode}
          onSearch={async (m) => { await runSearch([m]); setSelectedId(null); }}
          onIgnore={async (m) => { await runIgnore([m]); setSelectedId(null); }}
          onDelete={async (m, triggerSearch) => {
            if (!confirm(`Delete file for "${m.title}"? This cannot be undone.`)) return;
            await runDelete([m], triggerSearch);
            setSelectedId(null);
          }}
        />
      </PageErrorBoundary>
    </AppShell>
  );
}
