"use client";

import { useSeries } from "./useSeries";
import { useFlaggedMediaData } from "./useFlaggedMediaData";
import type { FlaggedMediaData } from "./useFlaggedMediaData";
import type { MediaFilters } from "./useMediaFilters";
import type { FlaggedSeries, ScoringMode } from "@/shared/types/models";

interface Args {
  activeInstance: number;
  filters: MediaFilters & { scoringMode: ScoringMode };
}

export interface FlaggedSeriesData extends Omit<FlaggedMediaData<FlaggedSeries>, "items"> {
  allSeries: FlaggedSeries[];
}

export function useFlaggedSeriesData({ activeInstance, filters }: Args): FlaggedSeriesData {
  const { items: allSeries, ...rest } = useFlaggedMediaData<FlaggedSeries>(useSeries, activeInstance, filters);
  return { allSeries, ...rest };
}
