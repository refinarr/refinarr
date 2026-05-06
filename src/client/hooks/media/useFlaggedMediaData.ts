"use client";

import type { MediaFilters } from "./useMediaFilters";
import type { FlaggedMedia, ScoringMode } from "@/shared/types/models";

type MediaQueryResult<T> = {
  data?: { pages: Array<{ items: T[]; total: number }> };
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => unknown;
  hasNextPage: boolean | undefined;
  refetch: () => unknown;
};

export type FlaggedMediaQueryHook<T extends FlaggedMedia> = (
  instanceId: number,
  filters: Omit<MediaFilters, "maxScore"> & {
    maxScore?: number;
    scoringMode: ScoringMode;
  },
) => MediaQueryResult<T>;

export interface FlaggedMediaData<T extends FlaggedMedia> {
  items: T[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => unknown;
  hasNextPage: boolean;
  refetch: () => unknown;
}

export function useFlaggedMediaData<T extends FlaggedMedia>(
  useQuery: FlaggedMediaQueryHook<T>,
  activeInstance: number,
  filters: Omit<MediaFilters, "maxScore"> & {
    maxScore?: number;
    scoringMode: ScoringMode;
  },
): FlaggedMediaData<T> {
  const q = useQuery(activeInstance, filters);
  return {
    items: q.data?.pages.flatMap((p) => p.items) ?? [],
    total: q.data?.pages[0]?.total ?? 0,
    isLoading: q.isLoading,
    isError: q.isError,
    isFetching: q.isFetching,
    isFetchingNextPage: q.isFetchingNextPage,
    fetchNextPage: q.fetchNextPage,
    hasNextPage: !!q.hasNextPage,
    refetch: q.refetch,
  };
}
