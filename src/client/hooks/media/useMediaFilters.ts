import { useState } from "react";
import type { MonitorStatus, Severity } from "@/shared/types/models";
import { useDebouncedValue } from "../ui/useDebouncedValue";

export type MatchMode = "any" | "all";

export interface MediaFilters {
  sortBy: "score" | "title" | "added" | "size";
  order: "asc" | "desc";
  // Score range over the profile custom-format score (raw integer).
  // null = no bound on that side. Bounds for the UI slider come from
  // the active profiles via the column funnel, not from here.
  minScore: number | null;
  maxScore: number | null;
  // Size range in bytes. null = no bound.
  minSize: number | null;
  maxSize: number | null;
  q: string;
  // Exact-match radarr/sonarr id. Set by history/dashboard deep-link
  // links; bypasses every other filter so the linked item is found
  // even if a stale severity/flagged filter would have excluded it.
  // `null` = no filter.
  mediaId: number | null;
  profileIds: number[];
  severities: Severity[];
  hasNegativeCfIds: number[];
  hasNegativeCfMatch: MatchMode;
  // Monitor-state filter. "all" (default) leaves the upstream untouched.
  // The other three values map 1:1 to the server's MonitorStatus filter
  // already enforced by parse-media-query + MediaService.
  monitorStatus: MonitorStatus;
  // Page-level view mode. true shows only flagged items; false includes
  // all media. Instance.showAllMedia supplies the per-instance default,
  // and the server still enforces flaggedOnly=true when that setting is off.
  flaggedOnly: boolean;
}

// Hook query input — every field optional. useMovies / useSeries /
// useMediaData accept this so they don't each redeclare their own
// near-identical filter type.
export type MediaQueryFilters = Partial<MediaFilters>;

export const defaultMediaFilters: MediaFilters = {
  sortBy: "score",
  order: "asc",
  minScore: null,
  maxScore: null,
  minSize: null,
  maxSize: null,
  q: "",
  mediaId: null,
  profileIds: [],
  severities: [],
  hasNegativeCfIds: [],
  hasNegativeCfMatch: "all",
  flaggedOnly: true,
  monitorStatus: "all",
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
  };
}

export function useMediaFilters(
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

  // CF IDs and quality-profile IDs are per-instance, so switching instance
  // leaves stale IDs in the filter that point at unrelated entities. Clear
  // them when the active instance changes.
  const [trackedInstance, setTrackedInstance] = useState({
    id: instanceId,
    showAllMedia,
  });
  if (trackedInstance.id !== instanceId) {
    setTrackedInstance({ id: instanceId, showAllMedia });
    setFilters((f) => ({
      ...f,
      // mediaId is instance-scoped (radarr/sonarr ids don't cross
      // instances). Leaving it set would short-circuit the server
      // filter to an empty result on the new instance.
      mediaId: null,
      profileIds: [],
      hasNegativeCfIds: [],
      hasNegativeCfMatch: "all",
      flaggedOnly: !showAllMedia,
    }));
  } else if (trackedInstance.showAllMedia !== showAllMedia) {
    setTrackedInstance({ id: instanceId, showAllMedia });
    setFilters((f) => ({ ...f, flaggedOnly: !showAllMedia }));
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
    },
  };
}
