"use client";
import { useInfiniteQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/client/lib/api";
import { queryKeys } from "@/client/lib/query-keys";
import type { FlaggedMovie, ScoringMode } from "@/shared/types/models";
import type { PaginatedResponse } from "@/shared/types/api";

interface MovieFilters {
  sortBy?: "score" | "title" | "added" | "size";
  order?: "asc" | "desc";
  maxScore?: number;
  q?: string;
  profileId?: number | null;
  missingCfIds?: number[];
  missingCfMatch?: "any" | "all";
  hasNegativeCfIds?: number[];
  hasNegativeCfMatch?: "any" | "all";
  scoringMode?: ScoringMode;
}

export function useMovies(instanceId: number, filters: MovieFilters = {}) {
  const params = new URLSearchParams({
    instanceId: String(instanceId),
    limit: "50",
  });
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) {
      if (v.length > 0) params.set(k, v.join(","));
    } else {
      params.set(k, String(v));
    }
  }

  return useInfiniteQuery({
    queryKey: queryKeys.movies(instanceId, filters),
    queryFn: ({ pageParam = 1 }) =>
      api.get<PaginatedResponse<FlaggedMovie>>(`/radarr/movies?${params}&page=${pageParam}`),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
    enabled: instanceId > 0,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useTriggerMovieSearch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ instanceId, mediaId, title }: { instanceId: number; mediaId: number; title: string }) =>
      api.post(`/radarr/movies/search`, { instanceId, mediaId, title }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["history"] });
      qc.invalidateQueries({ queryKey: queryKeys.searchQueue(variables.instanceId) });
      qc.invalidateQueries({ queryKey: ["search-queue", "all"] });
    },
  });
}
