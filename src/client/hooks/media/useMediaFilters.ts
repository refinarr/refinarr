import { useState } from "react";
import { useDebouncedValue } from "../ui/useDebouncedValue";
import { isManualMode } from "@/shared/scoring-mode";
import type { ScoringMode } from "@/shared/types/models";

export type MatchMode = "any" | "all";

export interface MediaFilters {
  sortBy: "score" | "title" | "added" | "size";
  order: "asc" | "desc";
  maxScore: number;
  q: string;
  profileId: number | null;
  missingCfIds: number[];
  missingCfMatch: MatchMode;
  hasNegativeCfIds: number[];
  hasNegativeCfMatch: MatchMode;
  onlyMissing: boolean;
}

// Hook query input — every field optional, plus scoringMode. useMovies /
// useSeries / useFlaggedMediaData accept this so they don't each redeclare
// their own near-identical filter type.
export type MediaQueryFilters = Partial<MediaFilters> & {
  scoringMode?: ScoringMode;
};

export const defaultMediaFilters: MediaFilters = {
  sortBy: "score",
  order: "asc",
  maxScore: 1,
  q: "",
  profileId: null,
  missingCfIds: [],
  missingCfMatch: "all",
  hasNegativeCfIds: [],
  hasNegativeCfMatch: "all",
  onlyMissing: false,
};

export interface MediaFiltersResult {
  filters: MediaFilters;
  setFilters: React.Dispatch<React.SetStateAction<MediaFilters>>;
  // maxScore is only meaningful in manual mode (a 0–1 coverage fraction).
  // In profile mode the score is a raw integer (-1000…cutoff) and the
  // slider isn't rendered, so omit the field so we don't accidentally
  // filter the page down to "score ≤ 1" on the API side.
  forQuery: Omit<MediaFilters, "maxScore"> & {
    maxScore?: number;
    scoringMode: ScoringMode;
  };
}

export function useMediaFilters(
  scoringMode: ScoringMode,
  instanceId: number,
): MediaFiltersResult {
  const [filters, setFilters] = useState<MediaFilters>(defaultMediaFilters);
  const debouncedMaxScore = useDebouncedValue(filters.maxScore, 400);
  const debouncedQ = useDebouncedValue(filters.q, 300);

  const [trackedMode, setTrackedMode] = useState(scoringMode);
  if (trackedMode !== scoringMode) {
    setTrackedMode(scoringMode);
    setFilters((f) => ({
      ...f,
      missingCfIds: [],
      missingCfMatch: "all",
      hasNegativeCfIds: [],
      hasNegativeCfMatch: "all",
      maxScore: 1,
    }));
  }

  // CF IDs and quality-profile IDs are per-instance, so switching instance
  // leaves stale IDs in the filter that point at unrelated entities. Clear
  // them when the active instance changes.
  const [trackedInstance, setTrackedInstance] = useState(instanceId);
  if (trackedInstance !== instanceId) {
    setTrackedInstance(instanceId);
    setFilters((f) => ({
      ...f,
      profileId: null,
      missingCfIds: [],
      missingCfMatch: "all",
      hasNegativeCfIds: [],
      hasNegativeCfMatch: "all",
    }));
  }

  return {
    filters,
    setFilters,
    forQuery: {
      ...filters,
      maxScore: isManualMode(scoringMode) ? debouncedMaxScore : undefined,
      q: debouncedQ,
      scoringMode,
    },
  };
}
