"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/client/lib/api";
import { queryKeys } from "@/client/lib/query-keys";
import { useDebouncedValue } from "@/client/hooks/ui/useDebouncedValue";
import type { AutoSearchStatus, CronPreviewResponse } from "@/shared/types/api";

export function useAutoSearchStatus(instanceId: number) {
  return useQuery({
    queryKey: queryKeys.autoSearchStatus(instanceId),
    queryFn: () =>
      api.get<AutoSearchStatus>(`/instances/${instanceId}/auto-search`),
    refetchInterval: (query) => (query.state.data?.running ? 5_000 : 30_000),
    enabled: instanceId > 0,
  });
}

export function useTriggerAutoSearch(instanceId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<{ enqueued: number }>(
        `/instances/${instanceId}/auto-search/trigger`,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: queryKeys.autoSearchStatus(instanceId),
      });
    },
  });
}

export function useCronPreview(expr: string) {
  const debounced = useDebouncedValue(expr, 400);
  return useQuery({
    queryKey: queryKeys.cronPreview(debounced),
    queryFn: () =>
      api.get<CronPreviewResponse>(
        `/auto-search/cron-preview?expr=${encodeURIComponent(debounced)}`,
      ),
    enabled: debounced.trim().split(/\s+/).length === 5,
    retry: false,
  });
}
