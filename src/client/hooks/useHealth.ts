"use client";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/client/lib/query-keys";
import { api } from "@/client/lib/api";

export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health(),
    queryFn: () => api.get<{ status: string }>("/health"),
    refetchInterval: 30_000,
    retry: false,
  });
}
