"use client";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
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

export function useTriggerMovieSearch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      instanceId,
      mediaId,
      title,
    }: {
      instanceId: number;
      mediaId: number;
      title: string;
    }) => api.post(`/radarr/movies/search`, { instanceId, mediaId, title }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.historyAll() });
      qc.invalidateQueries({
        queryKey: queryKeys.searchQueue(variables.instanceId),
      });
      qc.invalidateQueries({ queryKey: queryKeys.searchQueueAll() });
    },
  });
}
