"use client";
import { useInfiniteQuery, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/client/lib/api";
import { queryKeys } from "@/client/lib/query-keys";
import { appendFilterParams } from "@/client/lib/build-query-params";
import type { FlaggedSeries } from "@/shared/types/models";
import type { PaginatedResponse } from "@/shared/types/api";
import type { MediaQueryFilters } from "./useMediaFilters";

export function useSeries(instanceId: number, filters: MediaQueryFilters = {}) {
  const params = new URLSearchParams({
    instanceId: String(instanceId),
    limit: "50",
  });
  appendFilterParams(params, filters);

  return useInfiniteQuery({
    queryKey: queryKeys.series(instanceId, filters),
    queryFn: ({ pageParam = 1 }) =>
      api.get<PaginatedResponse<FlaggedSeries>>(
        `/sonarr/series?${params}&page=${pageParam}`,
      ),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
    enabled: instanceId > 0,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
