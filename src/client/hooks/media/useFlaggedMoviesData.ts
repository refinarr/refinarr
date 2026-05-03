import { useMovies } from "./useMovies";
import { useMoviesAll, type FlaggedMovieWithInstance } from "./useMoviesAll";
import type { MediaFilters } from "./useMediaFilters";
import type { ActiveInstance } from "./useInstanceSelection";
import type { ScoringMode } from "@/shared/types/models";

interface Args {
  activeInstance: ActiveInstance;
  instanceIds: number[];
  filters: MediaFilters & { scoringMode: ScoringMode };
}

export interface FlaggedMoviesData {
  allMovies: FlaggedMovieWithInstance[];
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

// Combines the single-instance infinite-query hook with the multi-instance
// useQueries-based hook. In single-instance mode each item is annotated with
// __instanceId from the active instance so the bulk-dispatch path is uniform
// across modes.
export function useFlaggedMoviesData({ activeInstance, instanceIds, filters }: Args): FlaggedMoviesData {
  const isAllMode = activeInstance === "all";
  const single = useMovies(isAllMode ? 0 : (activeInstance as number), filters);
  const allMode = useMoviesAll(isAllMode ? instanceIds : [], filters);

  const allMovies: FlaggedMovieWithInstance[] = isAllMode
    ? allMode.allMovies
    : (single.data?.pages.flatMap((p) => p.items) ?? []).map((m) => ({
        ...m,
        __instanceId: activeInstance as number,
      }));

  return {
    allMovies,
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
