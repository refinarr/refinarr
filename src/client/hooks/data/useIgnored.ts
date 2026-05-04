"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/client/lib/api";
import { queryKeys } from "@/client/lib/query-keys";
import type { IgnoreEntry } from "@/shared/types/models";

export function useIgnored(instanceId: number) {
  return useQuery({
    queryKey: queryKeys.ignore(instanceId),
    queryFn: () => api.get<IgnoreEntry[]>(`/ignore?instanceId=${instanceId}`),
    enabled: instanceId > 0,
  });
}

export function useUnignore(instanceId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ ok: boolean }>(`/ignore/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.ignore(instanceId) });
      qc.invalidateQueries({ queryKey: queryKeys.moviesAll(instanceId) });
      qc.invalidateQueries({ queryKey: queryKeys.seriesAll(instanceId) });
    },
  });
}
