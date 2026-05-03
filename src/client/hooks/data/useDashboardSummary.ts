"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/client/lib/api";
import type { DashboardSummary } from "@/shared/types/api";

export function useDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => api.get<DashboardSummary>("/dashboard/summary"),
    refetchInterval: 60_000,
  });
}
