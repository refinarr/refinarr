"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/client/lib/api";

export function useRefreshInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (instanceId: number) =>
      api.post<{ ok: boolean }>(`/instances/${instanceId}/refresh`, {}),
    onSuccess: (_data, instanceId) => {
      qc.invalidateQueries({ queryKey: ["movies", instanceId] });
      qc.invalidateQueries({ queryKey: ["series", instanceId] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      toast.success("Refreshed from Sonarr/Radarr");
    },
    onError: () => toast.error("Failed to refresh"),
  });
}
