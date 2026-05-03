import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useInstances } from "./useInstances";
import { useMovies } from "./useMovies";
import { useMoviesAll, type FlaggedMovieWithInstance } from "./useMoviesAll";
import { useConfig } from "./useConfig";
import { usePreferences } from "./usePreferences";
import { useDebouncedValue } from "./useDebouncedValue";
import { useInfiniteScroll } from "./useInfiniteScroll";
import { useBulkAbort, runWithAbort } from "./useBulkAbort";
import { useBulkMediaActions } from "./useBulkMediaActions";
import { buildInstanceBreakdown, type InstanceCount } from "@/client/lib/multi-instance-bulk";
import type { ScoringMode } from "@/shared/types/models";
import type { BulkProgress } from "@/client/components/media/BulkActionToolbar";

export interface MediaFilters {
  sortBy: "score" | "title" | "added" | "size";
  order: "asc" | "desc";
  maxScore: number;
  q: string;
  profileId: number | null;
  missingCfId: number | null;
  hasNegativeCfId: number | null;
}

export type ActiveInstance = number | "all";

export const defaultMediaFilters: MediaFilters = {
  sortBy: "score",
  order: "asc",
  maxScore: 1,
  q: "",
  profileId: null,
  missingCfId: null,
  hasNegativeCfId: null,
};

export function parseUrlInstance(raw: string | null): ActiveInstance {
  if (raw === "all") return "all";
  const n = Number(raw ?? "0");
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function useMoviesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: instances, isLoading: loadingInstances } = useInstances();
  const [instanceId, setInstanceId] = useState<ActiveInstance>(() => parseUrlInstance(searchParams.get("instanceId")));
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [filters, setFilters] = useState<MediaFilters>(defaultMediaFilters);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState<BulkProgress | null>(null);
  const abort = useBulkAbort();

  const radarrInstances = instances?.filter((i) => i.type === "radarr") ?? [];
  const radarrIds = radarrInstances.map((i) => i.id);
  const isAllMode = instanceId === "all";
  const activeInstance: ActiveInstance = isAllMode
    ? "all"
    : (typeof instanceId === "number" && instanceId > 0
        ? instanceId
        : radarrInstances[0]?.id ?? 0);

  const debouncedMaxScore = useDebouncedValue(filters.maxScore, 400);
  const debouncedQ = useDebouncedValue(filters.q, 300);

  const singleInstanceForPrefs = isAllMode ? 0 : (activeInstance as number);
  const { data: config } = useConfig();
  const { data: prefs } = usePreferences(singleInstanceForPrefs);

  const scoringMode = (config?.scoringModes[`scoringMode:${singleInstanceForPrefs}`] ?? "manual") as ScoringMode;
  const noCfsConfigured = !isAllMode && scoringMode === "manual" && (prefs?.length ?? 0) === 0;

  // Reset mode-specific filters when scoringMode changes. Adjust during render
  // — React aborts and restarts so there's no flash and no setState-in-effect.
  const [trackedMode, setTrackedMode] = useState(scoringMode);
  if (trackedMode !== scoringMode) {
    setTrackedMode(scoringMode);
    setFilters((f) => ({ ...f, missingCfId: null, hasNegativeCfId: null, maxScore: 1 }));
  }

  const sharedFilters = { ...filters, maxScore: debouncedMaxScore, q: debouncedQ, scoringMode };
  const single = useMovies(isAllMode ? 0 : (activeInstance as number), sharedFilters);
  const allMode = useMoviesAll(isAllMode ? radarrIds : [], sharedFilters);

  const sentinelRef = useInfiniteScroll(single.fetchNextPage, !isAllMode && !!single.hasNextPage);

  const allMovies: FlaggedMovieWithInstance[] = isAllMode
    ? allMode.allMovies
    : (single.data?.pages.flatMap((p) => p.items) ?? []).map((m) => ({
        ...m,
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
    useBulkMediaActions<FlaggedMovieWithInstance>({
      setProgress: setBulkProgress,
      refetch,
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
    });

  const runSearch = (movies: FlaggedMovieWithInstance[], isBulk = false) =>
    searchMutation.mutateAsync({ items: movies, isBulk });
  const runIgnore = (movies: FlaggedMovieWithInstance[], isBulk = false) =>
    ignoreWithToast({ items: movies, isBulk });
  const runDelete = (movies: FlaggedMovieWithInstance[], search: boolean, isBulk = false) =>
    deleteMutation.mutateAsync({ items: movies, search, isBulk });

  const selectedItems = () => allMovies.filter((m) => selected.has(m.id));
  const deletableSelected = () => selectedItems().filter((m) => m.hasFile && m.movieFileId > 0);
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

  const instanceBreakdown = (items: FlaggedMovieWithInstance[]): InstanceCount[] =>
    buildInstanceBreakdown(items, (id) => instances?.find((i) => i.id === id)?.name ?? `#${id}`);

  const selectedItem = allMovies.find((m) => m.id === selectedId) ?? null;

  return {
    router,
    instances,
    loadingInstances,
    radarrInstances,
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
    allMovies,
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
  };
}
