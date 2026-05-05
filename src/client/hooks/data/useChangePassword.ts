"use client";
import { useMutation } from "@tanstack/react-query";

export class PasswordChangeError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(status: number, code?: string, message?: string) {
    super(message ?? `Password change failed (${status})`);
    this.name = "PasswordChangeError";
    this.status = status;
    this.code = code;
  }
}

interface Vars {
  currentPassword: string;
  newPassword: string;
}

export function useChangePassword() {
  return useMutation<void, PasswordChangeError, Vars>({
    mutationFn: async (data) => {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) return;
      const body = await res.json().catch(() => null);
      throw new PasswordChangeError(res.status, body?.code, body?.error);
    },
  });
}
