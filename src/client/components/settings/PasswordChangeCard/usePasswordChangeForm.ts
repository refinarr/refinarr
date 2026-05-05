"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

// Owns the password-change form state. Validates length / match /
// difference-from-current locally, then POSTs to /api/auth/password and
// translates server status codes into i18n'd error messages.
export function usePasswordChangeForm() {
  const t = useTranslations("auth.password");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reset = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 12) { setErr(t("tooShort")); return; }
    if (next !== confirm) { setErr(t("mismatch")); return; }
    if (next === current) { setErr(t("sameAsCurrent")); return; }
    setErr(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      if (res.status === 401) { setErr(t("wrongCurrent")); setSubmitting(false); return; }
      if (res.status === 429) { setErr(t("tooManyAttempts")); setSubmitting(false); return; }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setErr(body?.error === "New password must differ from current" ? t("sameAsCurrent") : t("failed"));
        setSubmitting(false);
        return;
      }
      reset();
      setSubmitting(false);
      toast.success(t("changed"));
    } catch {
      setErr(t("failed"));
      setSubmitting(false);
    }
  };

  return {
    current, setCurrent,
    next, setNext,
    confirm, setConfirm,
    submitting,
    err,
    submit,
  };
}
