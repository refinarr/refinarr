"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { api } from "@/client/lib/api";

export function useRefreshInstance() {
  const t = useTranslations("toast.refresh");
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (instanceId: number) =>
      api.post<{ ok: boolean }>(`/instances/${instanceId}/refresh`, {}),
    onSuccess: (_data, instanceId) => {
      qc.invalidateQueries({ queryKey: ["movies", instanceId] });
      qc.invalidateQueries({ queryKey: ["series", instanceId] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      toast.success(t("done"));
    },
    onError: () => toast.error(t("failed")),
  });
}
