"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/client/lib/api";
import { queryKeys } from "@/client/lib/query-keys";
import type { ArrType, QualityProfile } from "@/shared/types/models";

export function useQualityProfiles(type: ArrType, instanceId: number) {
  return useQuery({
    queryKey: queryKeys.qualityProfiles(type, instanceId),
    queryFn: () =>
      api.get<QualityProfile[]>(
        `/${type}/qualityprofiles?instanceId=${instanceId}`,
      ),
    enabled: instanceId > 0,
  });
}
