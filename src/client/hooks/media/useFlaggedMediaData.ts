"use client";

import type { FlaggedMedia, ScoringMode } from "@/shared/types/models";
import type { MediaFilters } from "./useMediaFilters";

// Shape consumed by the query hooks (useMovies / useSeries) and by
// useFlaggedMediaData. Keeps every range bound nullable on the source
// MediaFilters but serialized to optional numbers — appendFilterParams
// drops undefined keys so the URL only carries actually-set bounds.
type ForQueryFilters = Omit<
  MediaFilters,
  "minScore" | "maxScore" | "minSize" | "maxSize"
> & {
  minScore?: number;
  maxScore?: number;
  minSize?: number;
  maxSize?: number;
  scoringMode: ScoringMode;
};

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
  filters: ForQueryFilters,
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
  filters: ForQueryFilters,
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
