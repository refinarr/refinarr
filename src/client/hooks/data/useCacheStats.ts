"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/client/lib/api";
import { queryKeys } from "@/client/lib/query-keys";
import type { CacheStatsSnapshot } from "@/shared/types/api";

const REFETCH_INTERVAL_MS = 30_000;

// Polls the diagnostics endpoint every 30 s. staleTime=0 so the cache
// reflects the latest poll, not the React Query freshness window.
export function useCacheStats() {
  return useQuery({
    queryKey: queryKeys.diagnosticsCache(),
    queryFn: () => api.get<CacheStatsSnapshot>("/diagnostics/cache"),
    refetchInterval: REFETCH_INTERVAL_MS,
    staleTime: 0,
  });
}

// Manual "Clear cache" button on /settings/diagnostics. Wraps with
// withToast at the call site (see useApiKeyActions for the pattern).
export function useClearCache() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<{ ok: boolean }>("/diagnostics/cache"),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.diagnosticsCache() });
    },
  });
}
