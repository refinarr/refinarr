"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

type Action = "reveal" | "rotate";

// Owns the reveal/rotate state machine for the API key card. Pulls the
// password-prompt dialog state, the protected fetch, and the per-action
// success-toast wiring out of the JSX file.
export function useApiKeyActions() {
  const tk = useTranslations("settings.apiKey");

  const [revealed, setRevealed] = useState<string | null>(null);
  const [pending, setPending] = useState<Action | null>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const ask = (action: Action) => {
    setPending(action);
    setPwErr(null);
    setPw("");
    setPwOpen(true);
  };

  const submit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!pending) return;
    setPwErr(null);
    setSubmitting(true);
    try {
      const url = pending === "rotate" ? "/api/config/api-key?action=rotate" : "/api/config/api-key";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (res.status === 401) { setPwErr(tk("wrongPassword")); setSubmitting(false); return; }
      if (res.status === 429) { setPwErr(tk("tooManyAttempts")); setSubmitting(false); return; }
      if (!res.ok) { setPwErr(tk("wrongPassword")); setSubmitting(false); return; }
      const data = (await res.json()) as { apiKey: string };
      setRevealed(data.apiKey);
      setPwOpen(false);
      setPw("");
      setSubmitting(false);
      if (pending === "rotate") toast.success(tk("rotated"));
    } catch {
      setPwErr(tk("wrongPassword"));
      setSubmitting(false);
    }
  };

  const copy = () => {
    if (!revealed) return;
    navigator.clipboard.writeText(revealed);
    toast.success(tk("copied"));
  };

  const hide = () => setRevealed(null);

  return {
    revealed,
    pending,
    pwOpen,
    setPwOpen,
    pw,
    setPw,
    pwErr,
    submitting,
    ask,
    submit,
    copy,
    hide,
  };
}
