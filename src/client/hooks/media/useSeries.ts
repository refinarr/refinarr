"use client";
import { useInfiniteQuery, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/client/lib/api";
import { queryKeys } from "@/client/lib/query-keys";
import { appendFilterParams } from "@/client/lib/build-query-params";
import type { SeriesItem } from "@/shared/types/models";
import type { PaginatedResponse } from "@/shared/types/api";
import type { MediaQueryFilters } from "./useMediaFilters";

export function useSeries(instanceId: number, filters: MediaQueryFilters = {}) {
  const params = new URLSearchParams({
    instanceId: String(instanceId),
    limit: "50",
  });
  appendFilterParams(params, filters);
  // See useMovies — appendFilterParams skips false, but the server
  // wants an explicit `flaggedOnly=false` for "Show all".
  if (filters.flaggedOnly === false) params.set("flaggedOnly", "false");

  return useInfiniteQuery({
    queryKey: queryKeys.series(instanceId, filters),
    queryFn: ({ pageParam = 1 }) =>
      api.get<PaginatedResponse<SeriesItem>>(
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
