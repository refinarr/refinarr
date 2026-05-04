"use client";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/client/lib/query-keys";
import { api } from "@/client/lib/api";
import type { DashboardSummary } from "@/shared/types/api";

export function useDashboardSummary() {
  return useQuery({
    queryKey: queryKeys.dashboardSummary(),
    queryFn: () => api.get<DashboardSummary>("/dashboard/summary"),
    refetchInterval: 60_000,
  });
}
