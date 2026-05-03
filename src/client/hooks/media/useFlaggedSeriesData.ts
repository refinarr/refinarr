import { useSeries } from "./useSeries";
import type { MediaFilters } from "./useMediaFilters";
import type { FlaggedSeries, ScoringMode } from "@/shared/types/models";

interface Args {
  activeInstance: number;
  filters: MediaFilters & { scoringMode: ScoringMode };
}

export interface FlaggedSeriesData {
  allSeries: FlaggedSeries[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => unknown;
  hasNextPage: boolean;
  refetch: () => unknown;
}

export function useFlaggedSeriesData({ activeInstance, filters }: Args): FlaggedSeriesData {
  const single = useSeries(activeInstance, filters);
  const allSeries = single.data?.pages.flatMap((p) => p.items) ?? [];

  return {
    allSeries,
    total: single.data?.pages[0]?.total ?? 0,
    isLoading: single.isLoading,
    isError: single.isError,
    isFetching: single.isFetching,
    isFetchingNextPage: single.isFetchingNextPage,
    fetchNextPage: single.fetchNextPage,
    hasNextPage: !!single.hasNextPage,
    refetch: single.refetch,
  };
}
