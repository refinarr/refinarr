"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/client/lib/api";
import { queryKeys } from "@/client/lib/query-keys";
import { ALL_ARR_TYPES } from "@/shared/arr-meta";
import type { ArrType } from "@/shared/types/models";
import type {
  CreateInstanceDto,
  PublicInstance,
  UpdateInstanceDto,
} from "@/shared/types/api";

export function useInstances() {
  return useQuery({
    queryKey: queryKeys.instances(),
    queryFn: () => api.get<PublicInstance[]>("/instances"),
  });
}

// Arr types that have at least one configured instance, in canonical
// ARR_META order. Drives the per-arr UI surfaces (nav, command palette,
// mobile tab bar, dashboard KPIs) so a Radarr-only user doesn't see a
// phantom Shows tab (#53). While instances are still loading or none
// exist yet (first run), returns ALL supported types — hiding everything
// during onboarding would leave an empty husk, and the no-instances
// prompts already guide the user to add one.
export function useConfiguredArrTypes(): ArrType[] {
  const { data: instances } = useInstances();
  if (!instances || instances.length === 0) return ALL_ARR_TYPES;
  const present = new Set(instances.map((i) => i.type));
  return ALL_ARR_TYPES.filter((t) => present.has(t));
}

export function useCreateInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateInstanceDto) =>
      api.post<PublicInstance>("/instances", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.instances() }),
  });
}

export function useUpdateInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateInstanceDto }) =>
      api.put<PublicInstance>(`/instances/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.instances() }),
  });
}

export function useDeleteInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<{ ok: boolean }>(`/instances/${id}`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: queryKeys.instances() });
      // Server-side: InstanceService.delete already calls
      // searchWorker.refresh(id) which clears the timer. The pending rows
      // for that instance stay until the user clears them, but /queue
      // should drop the deleted instance's section immediately.
      qc.invalidateQueries({ queryKey: queryKeys.searchQueue(id) });
      qc.invalidateQueries({ queryKey: queryKeys.searchQueueAll() });
    },
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

export function useTestCredentials() {
  return useMutation({
    mutationFn: async (data: {
      type: ArrType;
      url: string;
      apiKey: string;
    }) => {
      const result = await api.post<{ ok: boolean }>("/instances/test", data);
      if (!result.ok) throw new Error("Connection failed");
      return result;
    },
  });
}

export function useInstanceHealth(id: number) {
  return useQuery({
    queryKey: queryKeys.instanceHealth(id),
    queryFn: () => api.post<{ ok: boolean }>(`/instances/${id}/test`, {}),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: false,
    enabled: id > 0,
  });
}
