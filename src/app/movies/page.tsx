"use client";
import { Suspense } from "react";
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
import { NoFilterMatchState } from "@/client/components/states/NoFilterMatchState";
import { PageErrorBoundary } from "@/client/components/states/PageErrorBoundary";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/client/components/ui/select";
import { MovieDetailDrawer } from "@/client/components/movies/MovieDetailDrawer";
import { ScoringModeSelector } from "@/client/components/settings/ScoringModeSelector";
import { useMoviesPage } from "@/client/hooks/useMoviesPage";
import { useQualityProfiles } from "@/client/hooks/useQualityProfiles";
import { usePreferences } from "@/client/hooks/usePreferences";
import { useRefreshInstance } from "@/client/hooks/useRefreshInstance";
import { useConfirm } from "@/client/hooks/useConfirm";
import { getSeverity } from "@/client/lib/severity";
import { formatBytes } from "@/client/lib/format";
import { Button } from "@/client/components/ui/button";
import { useTranslations } from "next-intl";
import type { FlaggedMovie } from "@/shared/types/models";
import { Loader2, RefreshCw } from "lucide-react";

export default function MoviesPage() {
  return (
    <Suspense fallback={<AppShell><MediaTableSkeleton rows={8} /></AppShell>}>
      <MoviesPageContent />
    </Suspense>
  );
}

function MoviesPageContent() {
  const t = useTranslations("movies");
  const tCols = useTranslations("movies.columns");
  const tFilters = useTranslations("filters");
  const tConfirmDeleteFile = useTranslations("confirm.deleteFile");
  const tConfirmDeleteMovies = useTranslations("confirm.deleteMovies");
  const {
    router, instances, loadingInstances, radarrInstances,
    activeInstance, setInstanceId, selected, toggle,
    filters, setFilters, selectedId, setSelectedId, selectedItem,
    allMovies, total, isLoading, isFetching, isError, isFetchingNextPage,
    refetch, sentinelRef, scoringMode, noCfsConfigured, bulkProgress,
    handleSearch, handleIgnore, handleDelete, deletableCount, runSearch, runIgnore, runDelete,
  } = useMoviesPage();

  const { data: profiles } = useQualityProfiles("radarr", activeInstance);
  const { data: prefs } = usePreferences(activeInstance);
  const refreshMutation = useRefreshInstance();
  const { confirm: askConfirm, dialog: confirmDialog } = useConfirm();

  const wantedCfOptions = (prefs ?? []).map((p) => ({ id: p.cfId, name: p.cfName }));
  const negativeCfOptions = (() => {
    const seen = new Map<number, string>();
    for (const p of profiles ?? []) {
      for (const item of p.formatItems ?? []) {
        if (item.score < 0) seen.set(item.format, item.name);
      }
    }
    return Array.from(seen, ([id, name]) => ({ id, name }));
  })();

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
        return <SeverityDot severity={getSeverity(score, m.minProfileScore, scoringMode, m.hasFile)} />;
      },
    },
    {
      key: "title",
      header: tCols("title"),
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
      header: tCols("profile"),
      className: "w-36 text-muted-foreground",
      render: (m) => (
        <span className="truncate text-xs">
          {profiles?.find((p) => p.id === m.qualityProfileId)?.name ?? "—"}
        </span>
      ),
    },
    {
      key: "score",
      header: tCols("score"),
      sortKey: "score",
      className: "w-36 whitespace-nowrap",
      render: (m) => {
        if (scoringMode === "profile" && !m.hasFile)
          return <span className="text-xs text-muted-foreground">{t("noFile")}</span>;
        return (
          <ScoreLabel
            score={scoringMode === "profile" ? m.customFormatScore : m.cfScore}
            minProfileScore={m.minProfileScore}
          />
        );
      },
    },
    {
      key: "size",
      header: tCols("size"),
      sortKey: "size",
      className: "w-24 text-xs text-muted-foreground tabular-nums whitespace-nowrap",
      render: (m) => formatBytes(m.sizeOnDisk),
    },
    {
      key: "issues",
      header: scoringMode === "profile" ? tCols("penalties") : tCols("missing"),
      render: (m) => {
        const items = scoringMode === "profile" ? m.unwantedFormats : m.missingFormats;
        if (!items.length) return null;
        return (
          <div className="flex flex-wrap gap-1">
            {items.slice(0, 3).map((cf) => (
              <CfBadge key={cf.id} name={cf.name} missing />
            ))}
            {items.length > 3 && (
              <span className="text-xs text-muted-foreground">+{items.length - 3}</span>
            )}
          </div>
        );
      },
    },
  ];

  const profileName = profiles?.find((p) => p.id === filters.profileId)?.name;
  const missingCfName = wantedCfOptions.find((c) => c.id === filters.missingCfId)?.name;
  const penaltyCfName = negativeCfOptions.find((c) => c.id === filters.hasNegativeCfId)?.name;

  const chips: FilterChip[] = [
    filters.q && {
      key: "q",
      label: tFilters("queryLabel", { q: filters.q }),
      onRemove: () => setFilters((f) => ({ ...f, q: "" })),
    },
    filters.profileId !== null && profileName && {
      key: "profile",
      label: tFilters("profileLabel", { name: profileName }),
      onRemove: () => setFilters((f) => ({ ...f, profileId: null })),
    },
    filters.missingCfId !== null && missingCfName && {
      key: "cf",
      label: tFilters("missingLabel", { name: missingCfName }),
      onRemove: () => setFilters((f) => ({ ...f, missingCfId: null })),
    },
    filters.hasNegativeCfId !== null && penaltyCfName && {
      key: "ncf",
      label: tFilters("penaltyLabel", { name: penaltyCfName }),
      onRemove: () => setFilters((f) => ({ ...f, hasNegativeCfId: null })),
    },
  ].filter(Boolean) as FilterChip[];

  return (
    <AppShell>
      <PageErrorBoundary>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{t("title")}</h1>
              {!isLoading && (
                <p className="text-muted-foreground text-sm mt-1 flex items-center gap-1.5">
                  {t("flaggedSummary", { total, selected: selected.size })}
                  {isFetching && <Loader2 className="h-3 w-3 animate-spin" />}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {activeInstance > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => refreshMutation.mutate(activeInstance)}
                  disabled={refreshMutation.isPending || activeInstance <= 0}
                  title={t("refreshTitle")}
                  aria-label={t("refreshTitle")}
                >
                  <RefreshCw className={`h-4 w-4 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
                </Button>
              )}
              {activeInstance > 0 && <ScoringModeSelector instanceId={activeInstance} />}
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
            progress={bulkProgress}
            onSearch={handleSearch}
            onDelete={async (search) => {
              const count = deletableCount();
              if (count === 0) return;
              const ok = await askConfirm({
                title: tConfirmDeleteMovies("title"),
                body: tConfirmDeleteMovies("body", { count }),
                destructive: true,
              });
              if (ok) handleDelete(search);
            }}
            onIgnore={handleIgnore}
          />

          {(isLoading || loadingInstances) && <MediaTableSkeleton />}
          {isError && <MediaErrorCard onRetry={refetch} />}
          {!loadingInstances && !isLoading && !isError && allMovies.length === 0 && (
            activeInstance
              ? noCfsConfigured
                ? <NoCfsPrompt />
                : (chips.length > 0
                    ? <NoFilterMatchState onClear={() => setFilters((f) => ({ ...f, q: "", profileId: null, missingCfId: null, hasNegativeCfId: null, maxScore: 1 }))} />
                    : <AllClearState />)
              : <NoCfsPrompt />
          )}

          {!isLoading && allMovies.length > 0 && (
            <div className={isFetching ? "opacity-50 pointer-events-none transition-opacity" : "transition-opacity"}>
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
                renderCard={(m) => {
                  const score = scoringMode === "profile" ? m.customFormatScore : m.cfScore;
                  const items = scoringMode === "profile" ? m.unwantedFormats : m.missingFormats;
                  return (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <SeverityDot severity={getSeverity(score, m.minProfileScore, scoringMode, m.hasFile)} />
                        <span className="font-medium truncate">{m.title}</span>
                        <span className="text-muted-foreground text-xs shrink-0">{m.year}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {scoringMode === "profile" && !m.hasFile ? (
                          <span>{t("noFile")}</span>
                        ) : (
                          <ScoreLabel score={score} minProfileScore={m.minProfileScore} />
                        )}
                        <span className="tabular-nums">{formatBytes(m.sizeOnDisk)}</span>
                      </div>
                      {items.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {items.slice(0, 3).map((cf) => <CfBadge key={cf.id} name={cf.name} missing />)}
                          {items.length > 3 && (
                            <span className="text-xs text-muted-foreground">+{items.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                }}
              />
            </div>
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
            const ok = await askConfirm({
              title: tConfirmDeleteFile("title"),
              body: tConfirmDeleteFile("body", { title: m.title }),
              destructive: true,
            });
            if (!ok) return;
            await runDelete([m], triggerSearch);
            setSelectedId(null);
          }}
        />
        {confirmDialog}
      </PageErrorBoundary>
    </AppShell>
  );
}
