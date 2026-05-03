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
import { MovieDetailDrawer } from "@/client/components/movies/MovieDetailDrawer";
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
import { useFlaggedMoviesData } from "@/client/hooks/media/useFlaggedMoviesData";
import { useBulkAbort } from "@/client/hooks/media/useBulkAbort";
import { useBulkMediaActions, type BulkActionsConfig } from "@/client/hooks/media/useBulkMediaActions";
import { useBulkHandlers } from "@/client/hooks/media/useBulkHandlers";
import { getSeverity } from "@/client/lib/severity";
import { formatBytes } from "@/client/lib/format";
import type { FlaggedMovie, ScoringMode } from "@/shared/types/models";

type MovieBulkConfig = Pick<
  BulkActionsConfig<FlaggedMovie>,
  "mediaType" | "search" | "ignore" | "delete"
>;

const MOVIE_BULK_CONFIG: MovieBulkConfig = {
  mediaType: "movie",
  search: {
    endpoint: "/radarr/movies/search",
    body: (m, instId) => ({ instanceId: instId, mediaId: m.id, title: m.title }),
  },
  ignore: {
    endpoint: "/ignore",
    body: (m, instId) => ({ instanceId: instId, mediaId: m.id, mediaType: "movie", title: m.title }),
  },
  delete: {
    endpoint: "/radarr/movies/delete",
    isDeletable: (m) => m.hasFile && m.movieFileId > 0,
    body: (m, instId, search) => ({
      instanceId: instId, mediaId: m.id, fileId: m.movieFileId, title: m.title, search,
    }),
  },
};

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
  const tInstSel = useTranslations("instanceSelector");
  const router = useRouter();

  const inst = useInstanceSelection("radarr");
  const { data: config } = useConfig();
  const { data: prefs } = usePreferences(inst.activeInstance);
  const { data: profiles } = useQualityProfiles("radarr", inst.activeInstance);
  const refreshMutation = useRefreshInstance();
  const { confirm: askConfirm, dialog: confirmDialog } = useConfirm();

  const scoringMode = (config?.scoringModes[`scoringMode:${inst.activeInstance}`] ?? "manual") as ScoringMode;
  const noCfsConfigured = scoringMode === "manual" && (prefs?.length ?? 0) === 0;

  const filters = useMediaFilters(scoringMode);
  const data = useFlaggedMoviesData({
    activeInstance: inst.activeInstance,
    filters: filters.forQuery,
  });
  const sentinelRef = useInfiniteScroll(data.fetchNextPage, data.hasNextPage);
  const selection = useMediaSelection<FlaggedMovie>(data.allMovies, MOVIE_BULK_CONFIG.delete.isDeletable);
  const drawer = useDetailDrawer<FlaggedMovie>(data.allMovies);

  const [bulkProgress, setBulkProgress] = useState<BulkProgress | null>(null);
  const abort = useBulkAbort();
  const actions = useBulkMediaActions<FlaggedMovie>({
    ...MOVIE_BULK_CONFIG,
    instanceId: inst.activeInstance,
    setProgress: setBulkProgress,
    refetch: data.refetch,
  });
  const handlers = useBulkHandlers<FlaggedMovie>({ selection, abort, actions });

  const runSearch = (m: FlaggedMovie) =>
    actions.searchMutation.mutateAsync({ items: [m], isBulk: false });
  const runIgnore = (m: FlaggedMovie) =>
    actions.ignoreWithToast({ items: [m], isBulk: false });
  const runDelete = (m: FlaggedMovie, search: boolean) =>
    actions.deleteMutation.mutateAsync({ items: [m], isBulk: false, search });

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
            arrType="radarr"
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
                title: tConfirmDeleteMovies("title"),
                body: tConfirmDeleteMovies("body", { count: items.length }),
                destructive: true,
              });
              if (ok) handlers.handleDelete(search);
            }}
            onIgnore={handlers.handleIgnore}
          />

          {(data.isLoading || inst.loadingInstances) && <MediaTableSkeleton />}
          {data.isError && <MediaErrorCard onRetry={data.refetch} />}
          {!inst.loadingInstances && !data.isLoading && !data.isError && data.allMovies.length === 0 && (
            inst.activeInstance > 0
              ? noCfsConfigured
                ? <NoCfsPrompt />
                : (chips.length > 0
                    ? <NoFilterMatchState onClear={() => filters.setFilters((f) => ({ ...f, q: "", profileId: null, missingCfId: null, hasNegativeCfId: null, maxScore: 1 }))} />
                    : <AllClearState />)
              : <NoCfsPrompt />
          )}

          {!data.isLoading && data.allMovies.length > 0 && (
            <div className={data.isFetching ? "opacity-50 pointer-events-none transition-opacity" : "transition-opacity"}>
              <MediaTable
                rows={data.allMovies}
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
                rowActions={(m) => (
                  <RowHoverActions
                    onSearch={() => runSearch(m)}
                    onIgnore={async () => { await runIgnore(m); }}
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
          {data.isFetchingNextPage && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        <MovieDetailDrawer
          movie={drawer.selectedItem}
          open={drawer.selectedId !== null}
          onOpenChange={(open) => !open && drawer.setSelectedId(null)}
          scoringMode={scoringMode}
          onSearch={async () => {
            if (!drawer.selectedItem) return;
            await runSearch(drawer.selectedItem);
            drawer.setSelectedId(null);
          }}
          onIgnore={async () => {
            if (!drawer.selectedItem) return;
            await runIgnore(drawer.selectedItem);
            drawer.setSelectedId(null);
          }}
          onDelete={async (_m, triggerSearch) => {
            if (!drawer.selectedItem) return;
            const ok = await askConfirm({
              title: tConfirmDeleteFile("title"),
              body: tConfirmDeleteFile("body", { title: drawer.selectedItem.title }),
              destructive: true,
            });
            if (!ok) return;
            await runDelete(drawer.selectedItem, triggerSearch);
            drawer.setSelectedId(null);
          }}
        />
        {confirmDialog}
      </PageErrorBoundary>
    </AppShell>
  );
}
