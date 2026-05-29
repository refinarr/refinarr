"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/client/lib/api";
import { queryKeys } from "@/client/lib/query-keys";
import type { SystemInfo } from "@/shared/types/api";

const REFETCH_INTERVAL_MS = 60_000;

export function useSystem() {
  return useQuery({
    queryKey: queryKeys.system(),
    queryFn: () => api.get<SystemInfo>("/system"),
    refetchInterval: REFETCH_INTERVAL_MS,
    staleTime: 30_000,
  });
}

export function useRefreshSystem() {
  const qc = useQueryClient();
  return useMutation({
    // ?refresh=1 bypasses the server's 6h GitHub release cache.
    mutationFn: () => api.get<SystemInfo>("/system?refresh=1"),
    // setQueryData (not invalidateQueries) so the snapshot updates
    // synchronously — avoids a flicker between mutation done and the
    // next 60s poll.
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.system(), data);
    },
  });
}
