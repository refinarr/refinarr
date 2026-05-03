import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useInstances } from "./useInstances";
import { useMovies } from "./useMovies";
import { useConfig } from "./useConfig";
import { usePreferences } from "./usePreferences";
import { useDebouncedValue } from "./useDebouncedValue";
import { useInfiniteScroll } from "./useInfiniteScroll";
import { toast } from "sonner";
import { api } from "@/client/lib/api";
import { withToast } from "@/client/lib/with-toast";
import { runSerial } from "@/client/lib/run-serial";
import type { ActionLog, FlaggedMovie, ScoringMode } from "@/shared/types/models";
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

export function useMoviesPage() {
  const tSearch = useTranslations("toast.search");
  const tDelete = useTranslations("toast.delete");
  const tIgnore = useTranslations("toast.ignore");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: instances, isLoading: loadingInstances } = useInstances();
  const [instanceId, setInstanceId] = useState<number>(() => {
    const fromUrl = Number(searchParams.get("instanceId") ?? "0");
    return Number.isFinite(fromUrl) && fromUrl > 0 ? fromUrl : 0;
  });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [filters, setFilters] = useState<MediaFilters>({
    sortBy: "score",
    order: "asc",
    maxScore: 1,
    q: "",
    profileId: null,
    missingCfId: null,
    hasNegativeCfId: null,
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState<BulkProgress | null>(null);

  const activeInstance = instanceId || instances?.find((i) => i.type === "radarr")?.id || 0;
  const debouncedMaxScore = useDebouncedValue(filters.maxScore, 400);
  const debouncedQ = useDebouncedValue(filters.q, 300);

  const { data: config } = useConfig();
  const { data: prefs } = usePreferences(activeInstance);

  const scoringMode = (config?.scoringModes[`scoringMode:${activeInstance}`] ?? "manual") as ScoringMode;
  const noCfsConfigured = scoringMode === "manual" && (prefs?.length ?? 0) === 0;

  // Reset mode-specific filters when the user toggles scoring mode. Adjust
  // state during render — React aborts and restarts so there's no commit
  // between, no flash, and no setState-in-effect cascade.
  const [trackedMode, setTrackedMode] = useState(scoringMode);
  if (trackedMode !== scoringMode) {
    setTrackedMode(scoringMode);
    setFilters((f) => ({ ...f, missingCfId: null, hasNegativeCfId: null, maxScore: 1 }));
  }

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isFetching, isError, refetch } =
    useMovies(activeInstance, { ...filters, maxScore: debouncedMaxScore, q: debouncedQ, scoringMode });

  const sentinelRef = useInfiniteScroll(fetchNextPage, !!hasNextPage);
  const allMovies: FlaggedMovie[] = data?.pages.flatMap((p) => p.items) ?? [];
  const total = data?.pages[0]?.total ?? 0;
  const radarrInstances = instances?.filter((i) => i.type === "radarr") ?? [];

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const searchMutation = useMutation({
    mutationFn: async ({ movies, isBulk }: { movies: FlaggedMovie[]; isBulk: boolean }) =>
      runSerial(
        movies,
        (m) =>
          api.post<ActionLog>(`/radarr/movies/search`, {
            instanceId: activeInstance,
            mediaId: m.id,
            title: m.title,
          }),
        isBulk ? (current, total) => setBulkProgress({ current, total, action: "search" }) : undefined,
      ),
    onSuccess: (results) => {
      if (results.some((r) => r.isDryRun)) toast.info(tSearch("queuedDryRun"));
      else toast.success(tSearch("started"));
    },
    onError: () => toast.error(tSearch("failed")),
    onSettled: () => setBulkProgress(null),
  });

  const ignoreMutation = useMutation({
    mutationFn: async ({ movies, isBulk }: { movies: FlaggedMovie[]; isBulk: boolean }) =>
      runSerial(
        movies,
        (m) =>
          api.post(`/ignore`, {
            instanceId: activeInstance,
            mediaId: m.id,
            mediaType: "movie",
            title: m.title,
          }),
        isBulk ? (current, total) => setBulkProgress({ current, total, action: "ignore" }) : undefined,
      ),
    onSuccess: () => refetch(),
    onSettled: () => setBulkProgress(null),
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ movies, search, isBulk }: { movies: FlaggedMovie[]; search: boolean; isBulk: boolean }) => {
      const deletable = movies.filter((m) => m.hasFile && m.movieFileId > 0);
      const results = await runSerial(
        deletable,
        (m) =>
          api.post<ActionLog>(`/radarr/movies/delete`, {
            instanceId: activeInstance,
            mediaId: m.id,
            fileId: m.movieFileId,
            title: m.title,
            search,
          }),
        isBulk ? (current, total) => setBulkProgress({ current, total, action: "delete" }) : undefined,
      );
      return { results, search };
    },
    onSuccess: ({ results, search }) => {
      if (results.some((r) => r.isDryRun)) {
        toast.info(search ? tDelete("queuedAndSearchDryRun") : tDelete("queuedDryRun"));
      } else {
        toast.success(search ? tDelete("fileDoneAndSearch") : tDelete("fileDone"));
        void refetch();
      }
    },
    onError: () => toast.error(tDelete("fileFailed")),
    onSettled: () => setBulkProgress(null),
  });

  const runSearch = (movies: FlaggedMovie[], isBulk = false) =>
    searchMutation.mutateAsync({ movies, isBulk });
  const ignoreToast = withToast(ignoreMutation, { success: tIgnore("done"), error: tIgnore("failed") });
  const runIgnore = (movies: FlaggedMovie[], isBulk = false) => ignoreToast({ movies, isBulk });
  const runDelete = (movies: FlaggedMovie[], search: boolean, isBulk = false) =>
    deleteMutation.mutateAsync({ movies, search, isBulk });

  const handleSearch = async () => {
    const items = allMovies.filter((m) => selected.has(m.id));
    if (!items.length) return;
    await runSearch(items, true);
    setSelected(new Set());
  };

  const handleIgnore = async () => {
    const items = allMovies.filter((m) => selected.has(m.id));
    if (!items.length) return;
    await runIgnore(items, true);
    setSelected(new Set());
  };

  const deletableSelected = () =>
    allMovies.filter((m) => selected.has(m.id) && m.hasFile && m.movieFileId > 0);

  const handleDelete = async (search: boolean) => {
    const toDelete = deletableSelected();
    if (!toDelete.length) return;
    await runDelete(toDelete, search, true);
    setSelected(new Set());
  };

  const deletableCount = () => deletableSelected().length;

  const selectedItem = allMovies.find((m) => m.id === selectedId) ?? null;

  return {
    router,
    instances,
    loadingInstances,
    radarrInstances,
    activeInstance,
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
    isLoading,
    isError,
    isFetching,
    isFetchingNextPage,
    refetch,
    sentinelRef,
    scoringMode,
    noCfsConfigured,
    bulkProgress,
    handleSearch,
    handleIgnore,
    handleDelete,
    deletableCount,
    runSearch,
    runIgnore,
    runDelete,
  };
}
