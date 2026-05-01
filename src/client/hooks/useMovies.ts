"use client";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/client/lib/api";
import { queryKeys } from "@/client/lib/query-keys";
import type { FlaggedMovie } from "@/shared/types/models";
import type { PaginatedResponse } from "@/shared/types/api";

interface MovieFilters {
  sortBy?: "score" | "title" | "added";
  order?: "asc" | "desc";
  maxScore?: number;
  q?: string;
  profileId?: number | null;
  missingCfId?: number | null;
}

export function useMovies(instanceId: number, filters: MovieFilters = {}) {
  const params = new URLSearchParams({
    instanceId: String(instanceId),
    limit: "50",
    ...Object.fromEntries(
      Object.entries(filters)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => [k, String(v)])
    ),
  });

  return useInfiniteQuery({
    queryKey: queryKeys.movies(instanceId, filters),
    queryFn: ({ pageParam = 1 }) =>
      api.get<PaginatedResponse<FlaggedMovie>>(`/radarr/movies?${params}&page=${pageParam}`),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: instanceId > 0,
  });
}

export function useTriggerMovieSearch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ instanceId, mediaId, title }: { instanceId: number; mediaId: number; title: string }) =>
      api.post(`/radarr/movies/search`, { instanceId, mediaId, title }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["history"] }),
  });
}
