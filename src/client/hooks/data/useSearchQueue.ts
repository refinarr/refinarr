"use client";
import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/client/lib/query-keys";
import { api } from "@/client/lib/api";
import type { SearchQueueEntry } from "@/shared/types/models";

export interface QueueStatus {
  pendingCount: number;
  etaMs: number;
  items?: SearchQueueEntry[];
}

interface AllPendingResponse {
  items: SearchQueueEntry[];
}

export function useSearchQueue(instanceId: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.searchQueue(instanceId),
    queryFn: () => api.get<QueueStatus>(`/search-queue?instanceId=${instanceId}`),
    enabled: enabled && instanceId > 0,
    // Background poll so the badge ticks down as the worker drains.
    refetchInterval: 30_000,
  });
}

export function useAllPendingQueue() {
  return useQuery({
    queryKey: ["search-queue", "all"],
    queryFn: () => api.get<AllPendingResponse>("/search-queue"),
    refetchInterval: 10_000,
  });
}

export function useClearQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (instanceId: number) =>
      api.delete<{ removed: number }>(`/search-queue?instanceId=${instanceId}`),
    onSuccess: (_, instanceId) => {
      qc.invalidateQueries({ queryKey: queryKeys.searchQueue(instanceId) });
      qc.invalidateQueries({ queryKey: ["search-queue", "all"] });
    },
  });
}

/**
 * Set of mediaIds with at least one pending row in this instance's queue.
 * Used by /movies and /shows row renderers to show the "Pending search"
 * badge inline. For action="episode-file" rows, mediaId is the series id
 * — so the parent series correctly shows pending even when the queued
 * row targets a specific file.
 */
export function useQueuedMediaIds(instanceId: number): Set<number> {
  const { data } = useSearchQueue(instanceId, instanceId > 0);
  return useMemo(
    () => new Set((data?.items ?? []).map((row) => row.mediaId)),
    [data?.items]
  );
}
