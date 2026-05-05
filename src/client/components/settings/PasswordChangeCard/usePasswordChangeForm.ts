"use client";
import * as React from "react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useChangePassword, PasswordChangeError } from "@/client/hooks/data/useChangePassword";
import { withToast } from "@/client/lib/with-toast";

// At most one of these is set at a time. `form` is the bucket for errors
// that aren't anchored to a single field (rate-limit, same-as-current,
// generic failure). The card renders field errors inline and `form` as
// a role="alert" message above the submit button.
interface Errors {
  current?: string;
  next?: string;
  confirm?: string;
  form?: string;
}

export function usePasswordChangeForm() {
  const t = useTranslations("auth.password");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const change = useChangePassword();
  const changeWithToast = withToast(change, { success: t("changed"), error: t("failed") });

  const submit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (next.length < 12) return setErrors({ next: t("tooShort") });
    if (next !== confirm) return setErrors({ confirm: t("mismatch") });
    if (next === current) return setErrors({ form: t("sameAsCurrent") });
    setErrors({});
    try {
      await changeWithToast({ currentPassword: current, newPassword: next });
      setCurrent(""); setNext(""); setConfirm("");
    } catch (caught) {
      if (caught instanceof PasswordChangeError) {
        if (caught.status === 401) return setErrors({ current: t("wrongCurrent") });
        if (caught.status === 429) return setErrors({ form: t("tooManyAttempts") });
        if (caught.code === "SAME_AS_CURRENT") return setErrors({ form: t("sameAsCurrent") });
      }
      setErrors({ form: t("failed") });
    }
  };

  return {
    current, setCurrent,
    next, setNext,
    confirm, setConfirm,
    submitting: change.isPending,
    errors,
    submit,
  };
}
