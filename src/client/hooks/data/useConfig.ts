"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/client/lib/api";
import { queryKeys } from "@/client/lib/query-keys";

interface AppConfig {
  dryRun: boolean;
}

export function useConfig() {
  return useQuery({
    queryKey: queryKeys.config(),
    queryFn: () => api.get<AppConfig>("/config"),
  });
}

export function useUpdateConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.put<{ ok: boolean }>("/config", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.config() }),
  });
}
