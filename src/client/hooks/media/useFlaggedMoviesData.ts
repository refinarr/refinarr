import { useMovies } from "./useMovies";
import type { MediaFilters } from "./useMediaFilters";
import type { FlaggedMovie, ScoringMode } from "@/shared/types/models";

interface Args {
  activeInstance: number;
  filters: MediaFilters & { scoringMode: ScoringMode };
}

export interface FlaggedMoviesData {
  allMovies: FlaggedMovie[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => unknown;
  hasNextPage: boolean;
  refetch: () => unknown;
}

export function useFlaggedMoviesData({ activeInstance, filters }: Args): FlaggedMoviesData {
  const single = useMovies(activeInstance, filters);
  const allMovies = single.data?.pages.flatMap((p) => p.items) ?? [];

  return {
    allMovies,
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
