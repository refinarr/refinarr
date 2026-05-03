"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/client/lib/api";
import { queryKeys } from "@/client/lib/query-keys";
import type { CfPreference } from "@/shared/types/models";

export function usePreferences(instanceId: number) {
  return useQuery({
    queryKey: queryKeys.preferences(instanceId),
    queryFn: () => api.get<CfPreference[]>(`/preferences?instanceId=${instanceId}`),
    enabled: instanceId > 0,
  });
}

export function useSetPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { instanceId: number; cfs: Array<{ cfId: number; cfName: string }> }) =>
      api.put<{ ok: boolean }>("/preferences", data),
    onSuccess: (_data, variables) =>
      qc.invalidateQueries({ queryKey: queryKeys.preferences(variables.instanceId) }),
  });
}
