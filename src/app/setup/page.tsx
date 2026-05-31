"use client";
import * as React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import { Input } from "@/client/components/ui/input";
import { PasswordInput } from "@/client/components/common/PasswordInput";
import { Button } from "@/client/components/ui/button";
import { FormField } from "@/client/components/ui/form-field";
import { api, ApiClientError } from "@/client/lib/api";

// Mirrors the server-side username rule (schemas.ts). Plain JS regex (no /v),
// so it's safe to compile here for client-side validation.
const USERNAME_RE = /^[a-zA-Z0-9_.-]+$/;

interface FieldErrors {
  username?: string;
  password?: string;
  confirm?: string;
  form?: string;
}

export default function SetupPage() {
  const t = useTranslations("auth.setup");
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const submit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Inline, per-field validation rendered via FormField — no native browser
    // tooltips (the form is noValidate), consistent with the rest of the app.
    const next: FieldErrors = {};
    if (
      username.length < 3 ||
      username.length > 64 ||
      !USERNAME_RE.test(username)
    )
      next.username = t("usernameInvalid");
    if (password.length < 12) next.password = t("tooShort");
    if (confirm !== password) next.confirm = t("mismatch");
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      await api.post("/auth/setup", { username, password });
      router.push("/dashboard");
    } catch (caught) {
      if (caught instanceof ApiClientError && caught.status === 409) {
        setErrors({ form: t("alreadyCompleted") });
      } else if (caught instanceof ApiClientError && caught.status === 429) {
        setErrors({ form: t("tooManyAttempts") });
      } else {
        setErrors({ form: t("failed") });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <FormField
              id="username"
              label={t("username")}
              error={errors.username}
            >
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </FormField>
            <FormField
              id="password"
              label={t("password")}
              description={
                password.length > 0 && password.length < 12
                  ? t("passwordProgress", { count: password.length })
                  : t("passwordHint")
              }
              error={errors.password}
            >
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </FormField>
            <FormField
              id="confirm"
              label={t("confirmPassword")}
              error={errors.confirm}
            >
              <PasswordInput
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </FormField>
            {errors.form && (
              <p className="text-destructive text-sm" role="alert">
                {errors.form}
              </p>
            )}
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t("submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
