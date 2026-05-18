"use client";
import { useInfiniteQuery, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/client/lib/api";
import { queryKeys } from "@/client/lib/query-keys";
import { appendFilterParams } from "@/client/lib/build-query-params";
import type { MovieItem } from "@/shared/types/models";
import type { PaginatedResponse } from "@/shared/types/api";
import type { MediaQueryFilters } from "./useMediaFilters";

export function useMovies(instanceId: number, filters: MediaQueryFilters = {}) {
  const params = new URLSearchParams({
    instanceId: String(instanceId),
    limit: "50",
  });
  appendFilterParams(params, filters);
  // appendFilterParams skips falsy booleans, but `flaggedOnly=false`
  // is the explicit "Show all" signal the server expects, so set it
  // by hand. The default (true) stays implicit — omitting matches the
  // server's parseMediaQuery default.
  if (filters.flaggedOnly === false) params.set("flaggedOnly", "false");

  return useInfiniteQuery({
    queryKey: queryKeys.movies(instanceId, filters),
    queryFn: ({ pageParam = 1 }) =>
      api.get<PaginatedResponse<MovieItem>>(
        `/radarr/movies?${params}&page=${pageParam}`,
      ),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
    enabled: instanceId > 0,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
