import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useInstances } from "./useInstances";
import { useSeries } from "./useSeries";
import { useSeriesAll, type FlaggedSeriesWithInstance } from "./useSeriesAll";
import { useConfig } from "./useConfig";
import { usePreferences } from "./usePreferences";
import { useDebouncedValue } from "./useDebouncedValue";
import { useInfiniteScroll } from "./useInfiniteScroll";
import { useBulkAbort, runWithAbort } from "./useBulkAbort";
import { useBulkMediaActions } from "./useBulkMediaActions";
import { useShowSeasonEpisodeActions } from "./useShowSeasonEpisodeActions";
import { buildInstanceBreakdown, type InstanceCount } from "@/client/lib/multi-instance-bulk";
import {
  defaultMediaFilters,
  parseUrlInstance,
  type MediaFilters,
  type ActiveInstance,
} from "./useMoviesPage";
import type { ScoringMode } from "@/shared/types/models";
import type { BulkProgress } from "@/client/components/media/BulkActionToolbar";

export function useShowsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: instances, isLoading: loadingInstances } = useInstances();
  const [instanceId, setInstanceId] = useState<ActiveInstance>(() => parseUrlInstance(searchParams.get("instanceId")));
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [filters, setFilters] = useState<MediaFilters>(defaultMediaFilters);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState<BulkProgress | null>(null);
  const abort = useBulkAbort();

  const sonarrInstances = instances?.filter((i) => i.type === "sonarr") ?? [];
  const sonarrIds = sonarrInstances.map((i) => i.id);
  const isAllMode = instanceId === "all";
  const activeInstance: ActiveInstance = isAllMode
    ? "all"
    : (typeof instanceId === "number" && instanceId > 0
        ? instanceId
        : sonarrInstances[0]?.id ?? 0);

  const debouncedMaxScore = useDebouncedValue(filters.maxScore, 400);
  const debouncedQ = useDebouncedValue(filters.q, 300);

  const singleInstanceForPrefs = isAllMode ? 0 : (activeInstance as number);
  const { data: config } = useConfig();
  const { data: prefs } = usePreferences(singleInstanceForPrefs);

  const scoringMode = (config?.scoringModes[`scoringMode:${singleInstanceForPrefs}`] ?? "manual") as ScoringMode;
  const noCfsConfigured = !isAllMode && scoringMode === "manual" && (prefs?.length ?? 0) === 0;

  const [trackedMode, setTrackedMode] = useState(scoringMode);
  if (trackedMode !== scoringMode) {
    setTrackedMode(scoringMode);
    setFilters((f) => ({ ...f, missingCfId: null, hasNegativeCfId: null, maxScore: 1 }));
  }

  const sharedFilters = { ...filters, maxScore: debouncedMaxScore, q: debouncedQ, scoringMode };
  const single = useSeries(isAllMode ? 0 : (activeInstance as number), sharedFilters);
  const allMode = useSeriesAll(isAllMode ? sonarrIds : [], sharedFilters);

  const sentinelRef = useInfiniteScroll(single.fetchNextPage, !isAllMode && !!single.hasNextPage);

  const allSeries: FlaggedSeriesWithInstance[] = isAllMode
    ? allMode.allSeries
    : (single.data?.pages.flatMap((p) => p.items) ?? []).map((s) => ({
        ...s,
        __instanceId: activeInstance as number,
      }));
  const total = isAllMode ? allMode.total : (single.data?.pages[0]?.total ?? 0);
  const truncated = isAllMode ? allMode.truncated : false;
  const perInstanceLimit = allMode.perInstanceLimit;
  const isLoading = isAllMode ? allMode.isLoading : single.isLoading;
  const isError = isAllMode ? allMode.isError : single.isError;
  const isFetching = isAllMode ? allMode.isFetching : single.isFetching;
  const isFetchingNextPage = !isAllMode && single.isFetchingNextPage;
  const refetch = isAllMode ? allMode.refetch : single.refetch;

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const { searchMutation, ignoreMutation, ignoreWithToast, deleteMutation } =
    useBulkMediaActions<FlaggedSeriesWithInstance>({
      setProgress: setBulkProgress,
      refetch,
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
    });

  const seasonEpisode = useShowSeasonEpisodeActions({
    fallbackInstance: isAllMode ? 0 : (activeInstance as number),
    refetch,
  });

  const runSearch = (series: FlaggedSeriesWithInstance[], isBulk = false) =>
    searchMutation.mutateAsync({ items: series, isBulk });
  const runIgnore = (series: FlaggedSeriesWithInstance[], isBulk = false) =>
    ignoreWithToast({ items: series, isBulk });
  const runDelete = (series: FlaggedSeriesWithInstance[], search: boolean, isBulk = false) =>
    deleteMutation.mutateAsync({ items: series, search, isBulk });

  const selectedItems = () => allSeries.filter((s) => selected.has(s.id));
  const deletableSelected = () => selectedItems().filter((s) => s.episodeFiles.length > 0);
  const deletableCount = () => deletableSelected().length;

  const handleSearch = async () => {
    const items = selectedItems();
    if (!items.length) return;
    await runWithAbort(abort, async (signal) => {
      await searchMutation.mutateAsync({ items, isBulk: true, signal });
      setSelected(new Set());
    });
  };

  const handleIgnore = async () => {
    const items = selectedItems();
    if (!items.length) return;
    await runWithAbort(abort, async (signal) => {
      await ignoreMutation.mutateAsync({ items, isBulk: true, signal });
      setSelected(new Set());
    });
  };

  const handleDelete = async (search: boolean) => {
    const toDelete = deletableSelected();
    if (!toDelete.length) return;
    await runWithAbort(abort, async (signal) => {
      await deleteMutation.mutateAsync({ items: toDelete, search, isBulk: true, signal });
      setSelected(new Set());
    });
  };

  const instanceBreakdown = (items: FlaggedSeriesWithInstance[]): InstanceCount[] =>
    buildInstanceBreakdown(items, (id) => instances?.find((i) => i.id === id)?.name ?? `#${id}`);

  const selectedItem = allSeries.find((s) => s.id === selectedId) ?? null;

  return {
    router,
    instances,
    loadingInstances,
    sonarrInstances,
    activeInstance,
    isAllMode,
    setInstanceId,
    selected,
    toggle,
    filters,
    setFilters,
    selectedId,
    setSelectedId,
    selectedItem,
    allSeries,
    total,
    truncated,
    perInstanceLimit,
    isLoading,
    isError,
    isFetching,
    isFetchingNextPage,
    refetch,
    sentinelRef,
    scoringMode,
    noCfsConfigured,
    bulkProgress,
    cancelBulk: abort.cancel,
    handleSearch,
    handleIgnore,
    handleDelete,
    deletableCount,
    deletableSelected,
    instanceBreakdown,
    runSearch,
    runIgnore,
    runDelete,
    runSearchSeason: seasonEpisode.runSearchSeason,
    runSearchEpisode: seasonEpisode.runSearchEpisode,
    runDeleteSeason: seasonEpisode.runDeleteSeason,
    runDeleteEpisode: seasonEpisode.runDeleteEpisode,
  };
}
