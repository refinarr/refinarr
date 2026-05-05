"use client";
import * as React from "react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useChangePassword, PasswordChangeError } from "@/client/hooks/data/useChangePassword";
import { withToast } from "@/client/lib/with-toast";

// Owns the password-change form state. Validates length / match /
// difference-from-current locally, then drives the useChangePassword
// mutation and translates structured errors into i18n'd inline messages.
export function usePasswordChangeForm() {
  const t = useTranslations("auth.password");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const change = useChangePassword();
  const changeWithToast = withToast(change, { success: t("changed"), error: t("failed") });

  const reset = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
  };

  const inlineMessage = (e: PasswordChangeError): string => {
    if (e.status === 401) return t("wrongCurrent");
    if (e.status === 429) return t("tooManyAttempts");
    if (e.code === "SAME_AS_CURRENT") return t("sameAsCurrent");
    return t("failed");
  };

  const submit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (next.length < 12) { setErr(t("tooShort")); return; }
    if (next !== confirm) { setErr(t("mismatch")); return; }
    if (next === current) { setErr(t("sameAsCurrent")); return; }
    setErr(null);
    try {
      await changeWithToast({ currentPassword: current, newPassword: next });
      reset();
    } catch (caught) {
      setErr(caught instanceof PasswordChangeError ? inlineMessage(caught) : t("failed"));
    }
  };

  return {
    current, setCurrent,
    next, setNext,
    confirm, setConfirm,
    submitting: change.isPending,
    err,
    submit,
  };
}
