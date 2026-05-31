"use client";
import { useMutation } from "@tanstack/react-query";
import { api, ApiClientError } from "@/client/lib/api";

interface Vars {
  currentPassword: string;
  newPassword: string;
  // Sent so the server can enforce the confirmation match (not just the UI).
  confirmPassword: string;
}

// Mutation throws ApiClientError on failure (status, code, traceId
// preserved from the canonical error response). The form hook switches
// on those fields — no domain-specific error subclass needed.
export function useChangePassword() {
  return useMutation<void, ApiClientError, Vars>({
    mutationFn: async (data) => {
      await api.post<void>("/auth/password", data);
    },
  });
}
