import { useState } from "react";
import { useDebouncedValue } from "../useDebouncedValue";
import type { ScoringMode } from "@/shared/types/models";

export interface MediaFilters {
  sortBy: "score" | "title" | "added" | "size";
  order: "asc" | "desc";
  maxScore: number;
  q: string;
  profileId: number | null;
  missingCfId: number | null;
  hasNegativeCfId: number | null;
}

export const defaultMediaFilters: MediaFilters = {
  sortBy: "score",
  order: "asc",
  maxScore: 1,
  q: "",
  profileId: null,
  missingCfId: null,
  hasNegativeCfId: null,
};

export interface MediaFiltersResult {
  filters: MediaFilters;
  setFilters: React.Dispatch<React.SetStateAction<MediaFilters>>;
  // The data-fetching hook receives a copy with maxScore + q debounced and
  // the active scoringMode merged in.
  forQuery: MediaFilters & { scoringMode: ScoringMode };
}

// Filters state with debounce on the slider/search inputs and an automatic
// reset of mode-specific fields when scoringMode toggles. Adjust during
// render — React aborts and restarts so there's no commit between, no
// flash, and no setState-in-effect cascade.
export function useMediaFilters(scoringMode: ScoringMode): MediaFiltersResult {
  const [filters, setFilters] = useState<MediaFilters>(defaultMediaFilters);
  const debouncedMaxScore = useDebouncedValue(filters.maxScore, 400);
  const debouncedQ = useDebouncedValue(filters.q, 300);

  const [trackedMode, setTrackedMode] = useState(scoringMode);
  if (trackedMode !== scoringMode) {
    setTrackedMode(scoringMode);
    setFilters((f) => ({ ...f, missingCfId: null, hasNegativeCfId: null, maxScore: 1 }));
  }

  return {
    filters,
    setFilters,
    forQuery: { ...filters, maxScore: debouncedMaxScore, q: debouncedQ, scoringMode },
  };
}
