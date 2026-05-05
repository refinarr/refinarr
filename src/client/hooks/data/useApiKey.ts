"use client";
import { useMutation } from "@tanstack/react-query";
import { api, ApiError } from "@/client/lib/api";

export class ApiKeyError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message?: string, code?: string) {
    super(message ?? `API key request failed (${status})`);
    this.name = "ApiKeyError";
    this.status = status;
    this.code = code;
  }
}

interface Vars {
  password: string;
}

interface ApiKeyResponse {
  apiKey: string;
}

async function postPassword(url: string, password: string): Promise<ApiKeyResponse> {
  try {
    return await api.post<ApiKeyResponse>(url, { password });
  } catch (error) {
    if (error instanceof ApiError) throw new ApiKeyError(error.status, error.message, error.code);
    throw new ApiKeyError(0, error instanceof Error ? error.message : undefined);
  }
}

export function useRevealApiKey() {
  return useMutation<ApiKeyResponse, ApiKeyError, Vars>({
    mutationFn: ({ password }) => postPassword("/config/api-key", password),
  });
}

export function useRotateApiKey() {
  return useMutation<ApiKeyResponse, ApiKeyError, Vars>({
    mutationFn: ({ password }) => postPassword("/config/api-key?action=rotate", password),
  });
}
