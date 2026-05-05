"use client";
import * as React from "react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useChangePassword, PasswordChangeError } from "@/client/hooks/data/useChangePassword";
import { withToast } from "@/client/lib/with-toast";

// One error at a time, but tagged so the card can anchor it to the right
// field (or to a form-level alert for non-field errors like rate-limit).
type ErrField = "current" | "next" | "confirm" | "form";
type FormError = { field: ErrField; message: string };

// Owns the password-change form state. Validates length / match /
// difference-from-current locally, then drives the useChangePassword
// mutation and translates structured errors into i18n'd inline messages
// anchored to the correct field.
export function usePasswordChangeForm() {
  const t = useTranslations("auth.password");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<FormError | null>(null);
  const change = useChangePassword();
  const changeWithToast = withToast(change, { success: t("changed"), error: t("failed") });

  const reset = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
  };

  const errorFor = (e: PasswordChangeError): FormError => {
    // Wrong current password is a field-specific failure — anchor to the
    // currentPassword input so the user knows which field to fix.
    if (e.status === 401) return { field: "current", message: t("wrongCurrent") };
    // Rate-limit and same-as-current are conditions about the request as a
    // whole, not any single field — surface them in a form-level alert.
    if (e.status === 429) return { field: "form", message: t("tooManyAttempts") };
    if (e.code === "SAME_AS_CURRENT") return { field: "form", message: t("sameAsCurrent") };
    return { field: "form", message: t("failed") };
  };

  const submit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (next.length < 12) { setErr({ field: "next", message: t("tooShort") }); return; }
    if (next !== confirm) { setErr({ field: "confirm", message: t("mismatch") }); return; }
    if (next === current) { setErr({ field: "form", message: t("sameAsCurrent") }); return; }
    setErr(null);
    try {
      await changeWithToast({ currentPassword: current, newPassword: next });
      reset();
    } catch (caught) {
      setErr(caught instanceof PasswordChangeError
        ? errorFor(caught)
        : { field: "form", message: t("failed") });
    }
  };

  return {
    current, setCurrent,
    next, setNext,
    confirm, setConfirm,
    submitting: change.isPending,
    currentErr: err?.field === "current" ? err.message : null,
    nextErr: err?.field === "next" ? err.message : null,
    confirmErr: err?.field === "confirm" ? err.message : null,
    formErr: err?.field === "form" ? err.message : null,
    submit,
  };
}
