"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/client/lib/query-keys";
import { api } from "@/client/lib/api";

export function useRefreshInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (instanceId: number) =>
      api.post<{ ok: boolean }>(`/instances/${instanceId}/refresh`, {}),
    onSuccess: (_data, instanceId) => {
      qc.invalidateQueries({ queryKey: queryKeys.moviesAll(instanceId) });
      qc.invalidateQueries({ queryKey: queryKeys.seriesAll(instanceId) });
      qc.invalidateQueries({ queryKey: queryKeys.dashboardSummary() });
    },
  });
}
