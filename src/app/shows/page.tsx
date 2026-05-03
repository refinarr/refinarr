"use client";
import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, RefreshCw } from "lucide-react";
import { AppShell } from "@/client/components/layout/AppShell";
import { BulkActionToolbar, type BulkProgress } from "@/client/components/media/BulkActionToolbar";
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
import { Button } from "@/client/components/ui/button";
import { SeriesDetailDrawer } from "@/client/components/shows/SeriesDetailDrawer";
import { ScoringModeSelector } from "@/client/components/settings/ScoringModeSelector";

import { useConfig } from "@/client/hooks/data/useConfig";
import { usePreferences } from "@/client/hooks/data/usePreferences";
import { useQualityProfiles } from "@/client/hooks/data/useQualityProfiles";
import { useRefreshInstance } from "@/client/hooks/data/useRefreshInstance";
import { useConfirm } from "@/client/hooks/ui/useConfirm";
import { useInfiniteScroll } from "@/client/hooks/ui/useInfiniteScroll";
import { useInstanceSelection } from "@/client/hooks/media/useInstanceSelection";
import { useMediaFilters } from "@/client/hooks/media/useMediaFilters";
import { useMediaSelection } from "@/client/hooks/media/useMediaSelection";
import { useDetailDrawer } from "@/client/hooks/media/useDetailDrawer";
import { useFlaggedSeriesData } from "@/client/hooks/media/useFlaggedSeriesData";
import { useBulkAbort } from "@/client/hooks/media/useBulkAbort";
import { useBulkMediaActions, type BulkActionsConfig } from "@/client/hooks/media/useBulkMediaActions";
import { useBulkHandlers } from "@/client/hooks/media/useBulkHandlers";
import { useShowSeasonEpisodeActions } from "@/client/hooks/media/useShowSeasonEpisodeActions";
import { getSeverity } from "@/client/lib/severity";
import { formatBytes } from "@/client/lib/format";
import type { FlaggedSeries, ScoringMode } from "@/shared/types/models";

type SeriesBulkConfig = Pick<
  BulkActionsConfig<FlaggedSeries>,
  "mediaType" | "search" | "ignore" | "delete"
>;

const SERIES_BULK_CONFIG: SeriesBulkConfig = {
  mediaType: "series",
  search: {
    endpoint: "/sonarr/series/search",
    body: (s, instId) => ({ instanceId: instId, mediaId: s.id, title: s.title }),
  },
  ignore: {
    endpoint: "/ignore",
    body: (s, instId) => ({ instanceId: instId, mediaId: s.id, mediaType: "series", title: s.title }),
  },
  delete: {
    endpoint: "/sonarr/series/delete",
    isDeletable: (s) => s.episodeFiles.length > 0,
    body: (s, instId, search) => ({
      instanceId: instId,
      mediaId: s.id,
      fileIds: s.episodeFiles.map((f) => f.id),
      title: s.title,
      search,
    }),
  },
};

export default function ShowsPage() {
  return (
    <Suspense fallback={<AppShell><MediaTableSkeleton rows={8} /></AppShell>}>
      <ShowsPageContent />
    </Suspense>
  );
}

function ShowsPageContent() {
  const t = useTranslations("shows");
  const tCols = useTranslations("shows.columns");
  const tFilters = useTranslations("filters");
  const tConfirmDeleteSeries = useTranslations("confirm.deleteSeries");
  const tInstSel = useTranslations("instanceSelector");
  const router = useRouter();

  const inst = useInstanceSelection("sonarr");
  const { data: config } = useConfig();
  const { data: prefs } = usePreferences(inst.activeInstance);
  const { data: profiles } = useQualityProfiles("sonarr", inst.activeInstance);
  const refreshMutation = useRefreshInstance();
  const { confirm: askConfirm, dialog: confirmDialog } = useConfirm();

  const scoringMode = (config?.scoringModes[`scoringMode:${inst.activeInstance}`] ?? "manual") as ScoringMode;
  const noCfsConfigured = scoringMode === "manual" && (prefs?.length ?? 0) === 0;

  const filters = useMediaFilters(scoringMode);
  const data = useFlaggedSeriesData({
    activeInstance: inst.activeInstance,
    filters: filters.forQuery,
  });
  const sentinelRef = useInfiniteScroll(data.fetchNextPage, data.hasNextPage);
  const selection = useMediaSelection<FlaggedSeries>(data.allSeries, SERIES_BULK_CONFIG.delete.isDeletable);
  const drawer = useDetailDrawer<FlaggedSeries>(data.allSeries);

  const [bulkProgress, setBulkProgress] = useState<BulkProgress | null>(null);
  const abort = useBulkAbort();
  const actions = useBulkMediaActions<FlaggedSeries>({
    ...SERIES_BULK_CONFIG,
    instanceId: inst.activeInstance,
    setProgress: setBulkProgress,
    refetch: data.refetch,
  });
  const handlers = useBulkHandlers<FlaggedSeries>({ selection, abort, actions });
  const seasonEpisode = useShowSeasonEpisodeActions({
    instanceId: inst.activeInstance,
    refetch: data.refetch,
  });

  const runSearch = (s: FlaggedSeries) =>
    actions.searchMutation.mutateAsync({ items: [s], isBulk: false });
  const runIgnore = (s: FlaggedSeries) =>
    actions.ignoreWithToast({ items: [s], isBulk: false });

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

  if (!inst.loadingInstances && !inst.instances?.length) {
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
        const hasFile = s.episodeFiles.length > 0;
        return <SeverityDot severity={getSeverity(score, s.minProfileScore, scoringMode, hasFile)} />;
      },
    },
    {
      key: "title",
      header: tCols("title"),
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
      header: tCols("profile"),
      className: "w-32 text-muted-foreground",
      render: (s) => (
        <span className="truncate text-xs">
          {profiles?.find((p) => p.id === s.qualityProfileId)?.name ?? "—"}
        </span>
      ),
    },
    {
      key: "score",
      header: tCols("score"),
      sortKey: "score",
      className: "w-36 whitespace-nowrap",
      render: (s) => {
        if (scoringMode === "profile" && s.episodeFiles.length === 0)
          return <span className="text-xs text-muted-foreground">{t("noFile")}</span>;
        return (
          <ScoreLabel
            score={scoringMode === "profile" ? s.customFormatScore : s.cfScore}
            minProfileScore={s.minProfileScore}
          />
        );
      },
    },
    {
      key: "size",
      header: tCols("size"),
      sortKey: "size",
      className: "w-24 text-xs text-muted-foreground tabular-nums whitespace-nowrap",
      render: (s) => formatBytes(s.sizeOnDisk),
    },
    {
      key: "episodes",
      header: tCols("episodes"),
      className: "w-20 text-xs text-muted-foreground tabular-nums",
      render: (s) => `${s.affectedEpisodeCount} / ${s.totalEpisodeCount}`,
    },
    {
      key: "issues",
      header: scoringMode === "profile" ? tCols("penalties") : tCols("missing"),
      render: (s) => {
        const items = scoringMode === "profile" ? s.unwantedFormats : s.missingFormats;
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

  const profileName = profiles?.find((p) => p.id === filters.filters.profileId)?.name;
  const missingCfName = wantedCfOptions.find((c) => c.id === filters.filters.missingCfId)?.name;
  const penaltyCfName = negativeCfOptions.find((c) => c.id === filters.filters.hasNegativeCfId)?.name;

  const chips: FilterChip[] = [
    filters.filters.q && {
      key: "q",
      label: tFilters("queryLabel", { q: filters.filters.q }),
      onRemove: () => filters.setFilters((f) => ({ ...f, q: "" })),
    },
    filters.filters.profileId !== null && profileName && {
      key: "profile",
      label: tFilters("profileLabel", { name: profileName }),
      onRemove: () => filters.setFilters((f) => ({ ...f, profileId: null })),
    },
    filters.filters.missingCfId !== null && missingCfName && {
      key: "cf",
      label: tFilters("missingLabel", { name: missingCfName }),
      onRemove: () => filters.setFilters((f) => ({ ...f, missingCfId: null })),
    },
    filters.filters.hasNegativeCfId !== null && penaltyCfName && {
      key: "ncf",
      label: tFilters("penaltyLabel", { name: penaltyCfName }),
      onRemove: () => filters.setFilters((f) => ({ ...f, hasNegativeCfId: null })),
    },
  ].filter(Boolean) as FilterChip[];

  return (
    <AppShell>
      <PageErrorBoundary>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{t("title")}</h1>
              {!data.isLoading && (
                <p className="text-muted-foreground text-sm mt-1 flex items-center gap-1.5">
                  {t("flaggedSummary", { total: data.total, selected: selection.selected.size })}
                  {data.isFetching && <Loader2 className="h-3 w-3 animate-spin" />}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {inst.activeInstance > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => refreshMutation.mutate(inst.activeInstance)}
                  disabled={refreshMutation.isPending}
                  title={t("refreshTitle")}
                  aria-label={t("refreshTitle")}
                >
                  <RefreshCw className={`h-4 w-4 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
                </Button>
              )}
              {inst.activeInstance > 0 && (
                <ScoringModeSelector instanceId={inst.activeInstance} />
              )}
              {inst.typedInstances.length > 1 && (
                <Select
                  value={String(inst.activeInstance)}
                  onValueChange={(v) => inst.setInstanceId(Number(v ?? 0))}
                >
                  <SelectTrigger className="w-44">
                    <SelectValue>
                      {inst.typedInstances.find((i) => i.id === inst.activeInstance)?.name ?? tInstSel("selectInstance")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {inst.typedInstances.map((i) => (
                      <SelectItem key={i.id} value={String(i.id)}>{i.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <MediaSearchBar
            arrType="sonarr"
            instanceId={inst.activeInstance}
            scoringMode={scoringMode}
            filters={filters.filters}
            onChange={(next) => filters.setFilters((prev) => ({ ...prev, ...next }))}
          />

          <ActiveFilterChips chips={chips} />

          <BulkActionToolbar
            selectedCount={selection.selected.size}
            progress={bulkProgress}
            onCancel={abort.cancel}
            onSearch={handlers.handleSearch}
            onDelete={async (search) => {
              const items = selection.deletableSelected;
              if (!items.length) return;
              const ok = await askConfirm({
                title: tConfirmDeleteSeries("title"),
                body: tConfirmDeleteSeries("body", { count: items.length }),
                destructive: true,
              });
              if (ok) handlers.handleDelete(search);
            }}
            onIgnore={handlers.handleIgnore}
          />

          {(data.isLoading || inst.loadingInstances) && <MediaTableSkeleton rows={8} />}
          {data.isError && <MediaErrorCard onRetry={data.refetch} />}
          {!inst.loadingInstances && !data.isLoading && !data.isError && data.allSeries.length === 0 && (
            inst.activeInstance > 0
              ? noCfsConfigured
                ? <NoCfsPrompt />
                : (chips.length > 0
                    ? <NoFilterMatchState onClear={() => filters.setFilters((f) => ({ ...f, q: "", profileId: null, missingCfId: null, hasNegativeCfId: null, maxScore: 1 }))} />
                    : <AllClearState />)
              : <NoCfsPrompt />
          )}

          {!data.isLoading && data.allSeries.length > 0 && (
            <div className={data.isFetching ? "opacity-50 pointer-events-none transition-opacity" : "transition-opacity"}>
              <MediaTable
                rows={data.allSeries}
                columns={columns}
                selectedIds={selection.selected}
                onToggleSelect={selection.toggle}
                onRowClick={drawer.setSelectedId}
                sortBy={filters.filters.sortBy}
                order={filters.filters.order}
                onSortChange={(key) =>
                  filters.setFilters((f) => ({
                    ...f,
                    sortBy: key,
                    order: f.sortBy === key && f.order === "asc" ? "desc" : "asc",
                  }))
                }
                rowActions={(s) => (
                  <RowHoverActions
                    onSearch={() => runSearch(s)}
                    onIgnore={async () => { await runIgnore(s); }}
                  />
                )}
                renderCard={(s) => {
                  const score = scoringMode === "profile" ? s.customFormatScore : s.cfScore;
                  const hasFile = s.episodeFiles.length > 0;
                  const items = scoringMode === "profile" ? s.unwantedFormats : s.missingFormats;
                  return (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <SeverityDot severity={getSeverity(score, s.minProfileScore, scoringMode, hasFile)} />
                        <span className="font-medium truncate">{s.title}</span>
                        <span className="text-muted-foreground text-xs shrink-0">{s.year}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {scoringMode === "profile" && !hasFile ? (
                          <span>{t("noFile")}</span>
                        ) : (
                          <ScoreLabel score={score} minProfileScore={s.minProfileScore} />
                        )}
                        <span className="tabular-nums">{formatBytes(s.sizeOnDisk)}</span>
                        <span className="tabular-nums">{s.affectedEpisodeCount}/{s.totalEpisodeCount} ep</span>
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
          {data.isFetchingNextPage && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        <SeriesDetailDrawer
          series={drawer.selectedItem}
          open={drawer.selectedId !== null}
          onOpenChange={(open) => !open && drawer.setSelectedId(null)}
          scoringMode={scoringMode}
          onIgnore={async () => {
            if (!drawer.selectedItem) return;
            await runIgnore(drawer.selectedItem);
            drawer.setSelectedId(null);
          }}
          onSearchSeason={seasonEpisode.runSearchSeason}
          onSearchEpisode={seasonEpisode.runSearchEpisode}
          onDeleteSeason={seasonEpisode.runDeleteSeason}
          onDeleteEpisode={seasonEpisode.runDeleteEpisode}
        />
        {confirmDialog}
      </PageErrorBoundary>
    </AppShell>
  );
}
