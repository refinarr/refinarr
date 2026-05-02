import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useInstances } from "./useInstances";
import { useMovies } from "./useMovies";
import { useConfig } from "./useConfig";
import { usePreferences } from "./usePreferences";
import { useDebouncedValue } from "./useDebouncedValue";
import { useInfiniteScroll } from "./useInfiniteScroll";
import { toast } from "sonner";
import { api } from "@/client/lib/api";
import { withToast } from "@/client/lib/with-toast";
import type { ActionLog, FlaggedMovie, ScoringMode } from "@/shared/types/models";

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

  const activeInstance = instanceId || instances?.find((i) => i.type === "radarr")?.id || 0;
  const debouncedMaxScore = useDebouncedValue(filters.maxScore, 400);
  const debouncedQ = useDebouncedValue(filters.q, 300);

  const { data: config } = useConfig();
  const { data: prefs } = usePreferences(activeInstance);

  const scoringMode = (config?.scoringModes[`scoringMode:${activeInstance}`] ?? "manual") as ScoringMode;
  const noCfsConfigured = scoringMode === "manual" && (prefs?.length ?? 0) === 0;

  const [isModeTransitioning, setIsModeTransitioning] = useState(false);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isFetching, isError, refetch } =
    useMovies(activeInstance, { ...filters, maxScore: debouncedMaxScore, q: debouncedQ, scoringMode });

  useEffect(() => {
    setIsModeTransitioning(true);
    setFilters((f) => ({ ...f, missingCfId: null, hasNegativeCfId: null, maxScore: 1 }));
  }, [scoringMode]);

  useEffect(() => {
    if (!isFetching) setIsModeTransitioning(false);
  }, [isFetching]);

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
    mutationFn: async (movies: FlaggedMovie[]) => {
      const results: ActionLog[] = [];
      for (const m of movies) {
        const r = await api.post<ActionLog>(`/radarr/movies/search`, { instanceId: activeInstance, mediaId: m.id, title: m.title });
        results.push(r);
      }
      return results;
    },
    onSuccess: (results) => {
      if (results.some((r) => r.isDryRun)) {
        toast.info("[Dry Run] Search queued");
      } else {
        toast.success("Search triggered");
      }
    },
    onError: () => toast.error("Failed to trigger search"),
  });

  const ignoreMutation = useMutation({
    mutationFn: async (movies: FlaggedMovie[]) => {
      for (const m of movies) {
        await api.post(`/ignore`, { instanceId: activeInstance, mediaId: m.id, mediaType: "movie", title: m.title });
      }
    },
    onSuccess: () => refetch(),
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ movies, search }: { movies: FlaggedMovie[]; search: boolean }) => {
      const results: ActionLog[] = [];
      for (const m of movies.filter((m) => m.hasFile && m.movieFileId > 0)) {
        const r = await api.post<ActionLog>(`/radarr/movies/delete`, {
          instanceId: activeInstance,
          mediaId: m.id,
          fileId: m.movieFileId,
          title: m.title,
          search,
        });
        results.push(r);
      }
      return { results, search };
    },
    onSuccess: ({ results, search }) => {
      if (results.some((r) => r.isDryRun)) {
        toast.info(search ? "[Dry Run] Delete & search queued" : "[Dry Run] Delete queued");
      } else {
        toast.success(search ? "File deleted, search triggered" : "File deleted");
        void refetch();
      }
    },
    onError: () => toast.error("Failed to delete file"),
  });

  const runSearch = (movies: FlaggedMovie[]) => searchMutation.mutateAsync(movies);
  const runIgnore = withToast(ignoreMutation, { success: "Items ignored", error: "Failed to ignore items" });
  const runDelete = (movies: FlaggedMovie[], search: boolean) =>
    deleteMutation.mutateAsync({ movies, search });

  const handleSearch = async () => {
    await runSearch(allMovies.filter((m) => selected.has(m.id)));
    setSelected(new Set());
  };

  const handleIgnore = async () => {
    await runIgnore(allMovies.filter((m) => selected.has(m.id)));
    setSelected(new Set());
  };

  const handleDelete = async (search: boolean) => {
    const toDelete = allMovies.filter((m) => selected.has(m.id) && m.hasFile && m.movieFileId > 0);
    if (!toDelete.length) return;
    if (!confirm(`Delete file for ${toDelete.length} movie(s)? This cannot be undone.`)) return;
    await runDelete(toDelete, search);
    setSelected(new Set());
  };

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
    isLoading: isLoading || isModeTransitioning,
    isError,
    isFetching,
    isFetchingNextPage,
    refetch,
    sentinelRef,
    scoringMode,
    noCfsConfigured,
    handleSearch,
    handleIgnore,
    handleDelete,
    runSearch,
    runIgnore,
    runDelete,
  };
}
