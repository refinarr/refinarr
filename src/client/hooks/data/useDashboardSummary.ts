"use client";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/client/lib/query-keys";
import { api } from "@/client/lib/api";
import type { DashboardSummary } from "@/shared/types/api";

// Refetch fast (5s) while any enabled instance still has a cold flagged-count
// cache (server returned null and kicked off a background warm). Once every
// enabled instance has a real number, settle into a 60s polling cadence.
const FAST_INTERVAL = 5_000;
const SLOW_INTERVAL = 60_000;

export function useDashboardSummary() {
  return useQuery({
    queryKey: queryKeys.dashboardSummary(),
    queryFn: () => api.get<DashboardSummary>("/dashboard/summary"),
    refetchInterval: (query) => {
      const data = query.state.data as DashboardSummary | undefined;
      if (!data) return FAST_INTERVAL;
      const hasCold = data.perInstance.some((p) => p.enabled && p.flaggedCount === null);
      return hasCold ? FAST_INTERVAL : SLOW_INTERVAL;
    },
  });
}
