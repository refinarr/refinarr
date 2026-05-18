"use client";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/client/lib/query-keys";
import { api } from "@/client/lib/api";

interface RecentSearchEntry {
  mediaId: number;
  lastSearchedAt: string;
}

interface RecentSearchesResponse {
  items: RecentSearchEntry[];
}

/**
 * Successful search ActionLog rows for the active instance within the
 * last hour. Backs the "Searched Xm ago" row badge in /movies and /shows.
 * Polls every minute — fast enough that a fresh search appears soon
 * after the worker fires it; slow enough that the badge "Xm ago" label
 * stays close to honest without hammering the API.
 */
function useRecentSearches(instanceId: number) {
  return useQuery({
    queryKey: queryKeys.recentSearches(instanceId),
    queryFn: () =>
      api.get<RecentSearchesResponse>(
        `/recent-searches?instanceId=${instanceId}&windowHours=1`,
      ),
    enabled: instanceId > 0,
    refetchInterval: 60_000,
  });
}

export function useRecentSearchMap(instanceId: number): Map<number, Date> {
  const { data } = useRecentSearches(instanceId);
  return useMemo(
    () =>
      new Map(
        (data?.items ?? []).map((r) => [r.mediaId, new Date(r.lastSearchedAt)]),
      ),
    [data?.items],
  );
}
