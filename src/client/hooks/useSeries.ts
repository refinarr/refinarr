"use client";
import { useInfiniteQuery } from "@tanstack/react-query";
import { api } from "@/client/lib/api";
import { queryKeys } from "@/client/lib/query-keys";
import type { FlaggedSeries } from "@/shared/types/models";
import type { PaginatedResponse } from "@/shared/types/api";

interface SeriesFilters {
  sortBy?: "score" | "title" | "added";
  order?: "asc" | "desc";
  maxScore?: number;
  q?: string;
  profileId?: number | null;
  missingCfId?: number | null;
}

export function useSeries(instanceId: number, filters: SeriesFilters = {}) {
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
    queryKey: queryKeys.series(instanceId, filters),
    queryFn: ({ pageParam = 1 }) =>
      api.get<PaginatedResponse<FlaggedSeries>>(`/sonarr/series?${params}&page=${pageParam}`),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: instanceId > 0,
  });
}
