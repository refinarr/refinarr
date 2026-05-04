"use client";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/client/lib/api";
import { queryKeys } from "@/client/lib/query-keys";
import type { ActionLog } from "@/shared/types/models";
import type { PaginatedResponse } from "@/shared/types/api";

interface HistoryFilters {
  instanceId?: number;
  status?: string;
  action?: string;
}

export function useHistory(filters: HistoryFilters = {}) {
  const params = new URLSearchParams(
    Object.fromEntries(
      Object.entries(filters)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    )
  );

  return useInfiniteQuery({
    queryKey: queryKeys.history(filters),
    queryFn: ({ pageParam = 1 }) =>
      api.get<PaginatedResponse<ActionLog>>(`/history?${params}&page=${pageParam}&limit=50`),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });
}

export function useHistoryErrors(instanceId: number) {
  return useQuery({
    queryKey: queryKeys.historyErrors(instanceId),
    queryFn: () => api.get<ActionLog[]>(`/history/errors?instanceId=${instanceId}`),
    enabled: instanceId > 0,
  });
}

export function useClearHistory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<{ ok: boolean }>("/history"),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.historyAll() }),
  });
}
