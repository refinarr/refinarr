"use client";

import { useMovies } from "./useMovies";
import { useFlaggedMediaData } from "./useFlaggedMediaData";
import type { FlaggedMediaData } from "./useFlaggedMediaData";
import type { MediaFilters } from "./useMediaFilters";
import type { FlaggedMovie, ScoringMode } from "@/shared/types/models";

interface Args {
  activeInstance: number;
  filters: MediaFilters & { scoringMode: ScoringMode };
}

export interface FlaggedMoviesData extends Omit<FlaggedMediaData<FlaggedMovie>, "items"> {
  allMovies: FlaggedMovie[];
}

export function useFlaggedMoviesData({ activeInstance, filters }: Args): FlaggedMoviesData {
  const { items: allMovies, ...rest } = useFlaggedMediaData<FlaggedMovie>(useMovies, activeInstance, filters);
  return { allMovies, ...rest };
}
