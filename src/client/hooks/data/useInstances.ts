"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/client/lib/api";
import { queryKeys } from "@/client/lib/query-keys";
import type { Instance } from "@/shared/types/models";
import type { CreateInstanceDto } from "@/shared/types/api";

export function useInstances() {
  return useQuery({
    queryKey: queryKeys.instances(),
    queryFn: () => api.get<Instance[]>("/instances"),
  });
}

export function useCreateInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateInstanceDto) => api.post<Instance>("/instances", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.instances() }),
  });
}

export function useUpdateInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateInstanceDto> }) =>
      api.put<Instance>(`/instances/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.instances() }),
  });
}

export function useDeleteInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ ok: boolean }>(`/instances/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.instances() }),
  });
}

export function useTestConnection() {
  return useMutation({
    mutationFn: async (id: number) => {
      const result = await api.post<{ ok: boolean }>(`/instances/${id}/test`);
      if (!result.ok) throw new Error("Connection failed");
      return result;
    },
  });
}

export function useInstanceHealth(id: number) {
  return useQuery({
    queryKey: ["instance-health", id],
    queryFn: () => api.post<{ ok: boolean }>(`/instances/${id}/test`, {}),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: false,
    enabled: id > 0,
  });
}
