"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/client/lib/query-keys";
import { api } from "@/client/lib/api";

interface Me {
  username: string;
  source: "session" | "proxy";
}

export function useMe() {
  return useQuery({
    queryKey: queryKeys.me(),
    queryFn: () => api.get<Me>("/auth/me"),
    staleTime: 60_000,
    retry: false,
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ ok: boolean }>("/auth/logout", {}),
    onSuccess: () => {
      qc.clear();
      window.location.href = "/login";
    },
  });
}
