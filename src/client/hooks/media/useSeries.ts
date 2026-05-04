"use client";
import { useInfiniteQuery, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/client/lib/api";
import { queryKeys } from "@/client/lib/query-keys";
import type { FlaggedSeries, ScoringMode } from "@/shared/types/models";
import type { PaginatedResponse } from "@/shared/types/api";

interface SeriesFilters {
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

export function useSeries(instanceId: number, filters: SeriesFilters = {}) {
  const params = new URLSearchParams({
    instanceId: String(instanceId),
    limit: "50",
  });
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null || v === "" || v === false) continue;
    if (Array.isArray(v)) {
      if (v.length > 0) params.set(k, v.join(","));
    } else {
      params.set(k, String(v));
    }
  }

  return useInfiniteQuery({
    queryKey: queryKeys.series(instanceId, filters),
    queryFn: ({ pageParam = 1 }) =>
      api.get<PaginatedResponse<FlaggedSeries>>(`/sonarr/series?${params}&page=${pageParam}`),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
    enabled: instanceId > 0,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
