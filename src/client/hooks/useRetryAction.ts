"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/client/lib/api";
import type { ActionLog } from "@/shared/types/models";

export function useRetryAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post<ActionLog>(`/history/${id}/retry`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["history"] }),
  });
}
