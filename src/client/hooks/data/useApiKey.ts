"use client";
import { useMutation } from "@tanstack/react-query";
import { api, ApiClientError } from "@/client/lib/api";

interface Vars {
  password: string;
}

interface ApiKeyResponse {
  apiKey: string;
}

// Both mutations throw ApiClientError on failure with the canonical
// status / code / traceId. Form hooks switch on status (401 →
// wrongPassword, 429 → tooManyAttempts) without a domain subclass.
export function useRevealApiKey() {
  return useMutation<ApiKeyResponse, ApiClientError, Vars>({
    mutationFn: ({ password }) =>
      api.post<ApiKeyResponse>("/config/api-key", { password }),
  });
}

export function useRotateApiKey() {
  return useMutation<ApiKeyResponse, ApiClientError, Vars>({
    mutationFn: ({ password }) =>
      api.post<ApiKeyResponse>("/config/api-key?action=rotate", { password }),
  });
}
