"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { useRevealApiKey, useRotateApiKey } from "@/client/hooks/data/useApiKey";
import { ApiClientError } from "@/client/lib/api";
import { withToast } from "@/client/lib/with-toast";

type Action = "reveal" | "rotate";

// Owns the reveal/rotate state machine for the API key card. Pulls the
// password-prompt dialog state, drives the protected API-key mutations, and
// translates status-specific errors into inline messages.
export function useApiKeyActions() {
  const tk = useTranslations("settings.apiKey");

  const [revealed, setRevealed] = useState<string | null>(null);
  const [pending, setPending] = useState<Action | null>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pwErr, setPwErr] = useState<string | null>(null);
  const reveal = useRevealApiKey();
  const rotate = useRotateApiKey();
  const copyClipboard = useMutation({
    mutationFn: (text: string) => navigator.clipboard.writeText(text),
  });
  const revealWithToast = withToast(reveal, { success: tk("revealed"), error: tk("revealFailed") });
  const rotateWithToast = withToast(rotate, { success: tk("rotated"), error: tk("rotateFailed") });
  const copyWithToast = withToast(copyClipboard, { success: tk("copied"), error: tk("copyFailed") });

  const resetPrompt = () => {
    setPw("");
    setPwOpen(false);
  };

  const inlineMessage = (e: ApiClientError): string => {
    if (e.status === 429) return tk("tooManyAttempts");
    return tk("wrongPassword");
  };

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
    const action = pending;
    try {
      const data = await (action === "rotate" ? rotateWithToast : revealWithToast)({ password: pw });
      setRevealed(data.apiKey);
      resetPrompt();
    } catch (caught) {
      setPwErr(caught instanceof ApiClientError ? inlineMessage(caught) : tk("wrongPassword"));
    }
  };

  const copy = () => {
    if (!revealed) return;
    copyWithToast(revealed);
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
    submitting: reveal.isPending || rotate.isPending,
    ask,
    submit,
    copy,
    hide,
  };
}
