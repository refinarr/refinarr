"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/client/lib/api";
import { queryKeys } from "@/client/lib/query-keys";
import type { ActionLog, ArrType } from "@/shared/types/models";
import type { ReleaseCandidate } from "@/shared/types/api";

// What the picker is targeting: a Radarr movie, or one Sonarr season.
// (Per-episode is deferred to a follow-up.)
export type ReleaseTarget =
  | { kind: "movie"; movieId: number }
  | { kind: "season"; seriesId: number; seasonNumber: number };

function releasesPath(instanceId: number, target: ReleaseTarget): string {
  if (target.kind === "movie") {
    return `/radarr/movies/releases?instanceId=${instanceId}&movieId=${target.movieId}`;
  }
  return `/sonarr/series/releases?instanceId=${instanceId}&seriesId=${target.seriesId}&seasonNumber=${target.seasonNumber}`;
}

// Interactive-search release list. Disabled until the dialog opens
// (`enabled`), never cached (live indexer data), and not retried — a
// failed indexer query should surface, not silently re-hammer the *arr.
export function useReleases(
  arrType: ArrType,
  instanceId: number,
  target: ReleaseTarget,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.releases(arrType, instanceId, target),
    queryFn: () =>
      api.get<ReleaseCandidate[]>(releasesPath(instanceId, target)),
    enabled: enabled && instanceId > 0,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export interface GrabVars {
  instanceId: number;
  mediaId: number;
  guid: string;
  indexerId: number;
  title: string;
}

// Per-arr grab endpoint — a Record keeps the arr-type dispatch out of a
// literal comparison (project convention: no `type === "radarr"`).
const GRAB_PATH: Record<ArrType, string> = {
  radarr: "/radarr/movies/grab",
  sonarr: "/sonarr/series/grab",
};

// Force-grab the picked release. Wrap the returned mutation with
// `withToast` at the call site (the success copy depends on isDryRun).
export function useGrabRelease(arrType: ArrType) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: GrabVars) =>
      api.post<ActionLog>(GRAB_PATH[arrType], vars),
    onSuccess: () => {
      // Surface the new grab row if the History view is open.
      qc.invalidateQueries({ queryKey: queryKeys.historyAll() });
    },
  });
}
