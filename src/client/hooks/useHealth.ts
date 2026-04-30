"use client";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/client/lib/query-keys";

export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health(),
    queryFn: () => fetch("/api/health").then((r) => r.json()) as Promise<{ status: string }>,
    refetchInterval: 30_000,
    retry: false,
  });
}
