import { useSeries } from "./useSeries";
import { useSeriesAll, type FlaggedSeriesWithInstance } from "./useSeriesAll";
import type { MediaFilters } from "./useMediaFilters";
import type { ActiveInstance } from "./useInstanceSelection";
import type { ScoringMode } from "@/shared/types/models";

interface Args {
  activeInstance: ActiveInstance;
  instanceIds: number[];
  filters: MediaFilters & { scoringMode: ScoringMode };
}

export interface FlaggedSeriesData {
  allSeries: FlaggedSeriesWithInstance[];
  total: number;
  truncated: boolean;
  perInstanceLimit: number;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => unknown;
  hasNextPage: boolean;
  refetch: () => unknown;
}

// See useFlaggedMoviesData for the single↔all branching rationale.
export function useFlaggedSeriesData({ activeInstance, instanceIds, filters }: Args): FlaggedSeriesData {
  const isAllMode = activeInstance === "all";
  const single = useSeries(isAllMode ? 0 : (activeInstance as number), filters);
  const allMode = useSeriesAll(isAllMode ? instanceIds : [], filters);

  const allSeries: FlaggedSeriesWithInstance[] = isAllMode
    ? allMode.allSeries
    : (single.data?.pages.flatMap((p) => p.items) ?? []).map((s) => ({
        ...s,
        __instanceId: activeInstance as number,
      }));

  return {
    allSeries,
    total: isAllMode ? allMode.total : (single.data?.pages[0]?.total ?? 0),
    truncated: isAllMode ? allMode.truncated : false,
    perInstanceLimit: allMode.perInstanceLimit,
    isLoading: isAllMode ? allMode.isLoading : single.isLoading,
    isError: isAllMode ? allMode.isError : single.isError,
    isFetching: isAllMode ? allMode.isFetching : single.isFetching,
    isFetchingNextPage: !isAllMode && single.isFetchingNextPage,
    fetchNextPage: single.fetchNextPage,
    hasNextPage: !isAllMode && !!single.hasNextPage,
    refetch: isAllMode ? allMode.refetch : single.refetch,
  };
}
