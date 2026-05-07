import { useState } from "react";
import type { ScoringMode, Severity } from "@/shared/types/models";
import { useDebouncedValue } from "../ui/useDebouncedValue";

export type MatchMode = "any" | "all";

export interface MediaFilters {
  sortBy: "score" | "title" | "added" | "size";
  order: "asc" | "desc";
  // Score range — manual mode 0..1, profile mode raw integer score.
  // null = no bound on that side. Bounds for the UI slider come from
  // the active mode/profiles via the column funnel, not from here.
  minScore: number | null;
  maxScore: number | null;
  // Size range in bytes. null = no bound.
  minSize: number | null;
  maxSize: number | null;
  q: string;
  profileIds: number[];
  severities: Severity[];
  missingCfIds: number[];
  missingCfMatch: MatchMode;
  hasNegativeCfIds: number[];
  hasNegativeCfMatch: MatchMode;
  onlyMissing: boolean;
  // Page-level "Show all" toggle. Default true mirrors the existing
  // contract (only flagged items are shown). When the user flips it
  // off, non-flagged items are included in the list — but only if the
  // active instance has the showAllMedia capability flag enabled, since
  // the server enforces flaggedOnly=true otherwise.
  flaggedOnly: boolean;
}

// Hook query input — every field optional, plus scoringMode. useMovies /
// useSeries / useMediaData accept this so they don't each redeclare
// their own near-identical filter type.
export type MediaQueryFilters = Partial<MediaFilters> & {
  scoringMode?: ScoringMode;
};

export const defaultMediaFilters: MediaFilters = {
  sortBy: "score",
  order: "asc",
  minScore: null,
  maxScore: null,
  minSize: null,
  maxSize: null,
  q: "",
  profileIds: [],
  severities: [],
  missingCfIds: [],
  missingCfMatch: "all",
  hasNegativeCfIds: [],
  hasNegativeCfMatch: "all",
  onlyMissing: false,
  flaggedOnly: true,
};

function mediaFiltersForInstance(showAllMedia: boolean): MediaFilters {
  return { ...defaultMediaFilters, flaggedOnly: !showAllMedia };
}

export interface MediaFiltersResult {
  filters: MediaFilters;
  setFilters: React.Dispatch<React.SetStateAction<MediaFilters>>;
  // null bounds are dropped on serialization — appendFilterParams skips
  // null/undefined, so the URL only carries actually-set bounds.
  forQuery: Omit<
    MediaFilters,
    "minScore" | "maxScore" | "minSize" | "maxSize"
  > & {
    minScore?: number;
    maxScore?: number;
    minSize?: number;
    maxSize?: number;
    scoringMode: ScoringMode;
  };
}

export function useMediaFilters(
  scoringMode: ScoringMode,
  instanceId: number,
  showAllMedia = false,
): MediaFiltersResult {
  const [filters, setFilters] = useState<MediaFilters>(() =>
    mediaFiltersForInstance(showAllMedia),
  );
  const debouncedMinScore = useDebouncedValue(filters.minScore, 400);
  const debouncedMaxScore = useDebouncedValue(filters.maxScore, 400);
  const debouncedMinSize = useDebouncedValue(filters.minSize, 400);
  const debouncedMaxSize = useDebouncedValue(filters.maxSize, 400);
  const debouncedQ = useDebouncedValue(filters.q, 300);

  // Score bounds change shape between manual and profile modes (0..1 vs
  // raw integer), so a value the user picked in one mode is meaningless
  // after switching. CF / penalty selections are also mode-specific.
  const [trackedMode, setTrackedMode] = useState(scoringMode);
  if (trackedMode !== scoringMode) {
    setTrackedMode(scoringMode);
    setFilters((f) => ({
      ...f,
      missingCfIds: [],
      missingCfMatch: "all",
      hasNegativeCfIds: [],
      hasNegativeCfMatch: "all",
      minScore: null,
      maxScore: null,
    }));
  }

  // CF IDs and quality-profile IDs are per-instance, so switching instance
  // leaves stale IDs in the filter that point at unrelated entities. Clear
  // them when the active instance changes.
  const [trackedInstance, setTrackedInstance] = useState({
    id: instanceId,
    showAllMedia,
  });
  if (
    trackedInstance.id !== instanceId ||
    trackedInstance.showAllMedia !== showAllMedia
  ) {
    setTrackedInstance({ id: instanceId, showAllMedia });
    setFilters((f) => ({
      ...f,
      profileIds: [],
      missingCfIds: [],
      missingCfMatch: "all",
      hasNegativeCfIds: [],
      hasNegativeCfMatch: "all",
      flaggedOnly: !showAllMedia,
    }));
  }

  return {
    filters,
    setFilters,
    forQuery: {
      ...filters,
      minScore: debouncedMinScore ?? undefined,
      maxScore: debouncedMaxScore ?? undefined,
      minSize: debouncedMinSize ?? undefined,
      maxSize: debouncedMaxSize ?? undefined,
      q: debouncedQ,
      scoringMode,
    },
  };
}
