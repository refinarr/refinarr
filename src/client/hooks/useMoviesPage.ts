import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useInstances } from "./useInstances";
import { useMovies } from "./useMovies";
import { useConfig } from "./useConfig";
import { usePreferences } from "./usePreferences";
import { useDebouncedValue } from "./useDebouncedValue";
import { useInfiniteScroll } from "./useInfiniteScroll";
import { api } from "@/client/lib/api";
import { withToast } from "@/client/lib/with-toast";
import type { FlaggedMovie, ScoringMode } from "@/shared/types/models";

export interface MediaFilters {
  sortBy: "score" | "title" | "added";
  order: "asc" | "desc";
  maxScore: number;
}

export function useMoviesPage() {
  const router = useRouter();
  const { data: instances, isLoading: loadingInstances } = useInstances();
  const [instanceId, setInstanceId] = useState<number>(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [filters, setFilters] = useState<MediaFilters>({ sortBy: "score", order: "asc", maxScore: 1 });

  const activeInstance = instanceId || instances?.[0]?.id || 0;
  const debouncedMaxScore = useDebouncedValue(filters.maxScore, 400);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, refetch } =
    useMovies(activeInstance, { ...filters, maxScore: debouncedMaxScore });
  const { data: config } = useConfig();
  const { data: prefs } = usePreferences(activeInstance);

  const scoringMode = (config?.scoringModes[`scoringMode:${activeInstance}`] ?? "manual") as ScoringMode;
  const noCfsConfigured = scoringMode === "manual" && (prefs?.length ?? 0) === 0;

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
      for (const m of movies) {
        await api.post(`/radarr/movies/search`, { instanceId: activeInstance, mediaId: m.id, title: m.title });
      }
    },
  });

  const ignoreMutation = useMutation({
    mutationFn: async (movies: FlaggedMovie[]) => {
      for (const m of movies) {
        await api.post(`/ignore`, { instanceId: activeInstance, mediaId: m.id, mediaType: "movie", title: m.title });
      }
    },
    onSuccess: () => refetch(),
  });

  const runSearch = withToast(searchMutation, { success: "Search triggered", error: "Failed to trigger search" });
  const runIgnore = withToast(ignoreMutation, { success: "Items ignored", error: "Failed to ignore items" });

  const handleSearch = async () => {
    await runSearch(allMovies.filter((m) => selected.has(m.id)));
    setSelected(new Set());
  };

  const handleIgnore = async () => {
    await runIgnore(allMovies.filter((m) => selected.has(m.id)));
    setSelected(new Set());
  };

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
    allMovies,
    total,
    isLoading,
    isError,
    isFetchingNextPage,
    refetch,
    sentinelRef,
    scoringMode,
    noCfsConfigured,
    handleSearch,
    handleIgnore,
  };
}
