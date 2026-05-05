"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/client/lib/api";
import { queryKeys } from "@/client/lib/query-keys";
import type { ArrType, CustomFormat } from "@/shared/types/models";

export function useCustomFormats(type: ArrType, instanceId: number) {
  return useQuery({
    queryKey: queryKeys.customFormats(type, instanceId),
    queryFn: () =>
      api.get<CustomFormat[]>(
        `/${type}/customformats?instanceId=${instanceId}`,
      ),
    enabled: instanceId > 0,
  });
}
