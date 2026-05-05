"use client";
import * as React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card";
import { Input } from "@/client/components/ui/input";
import { Button } from "@/client/components/ui/button";
import { FormField } from "@/client/components/ui/form-field";
import { Loader2 } from "lucide-react";

export default function SetupPage() {
  const t = useTranslations("auth.setup");
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (password.length < 12) { setErr(t("tooShort")); return; }
    if (password !== confirm) { setErr(t("mismatch")); return; }
    setErr(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        setErr(t("failed"));
        setSubmitting(false);
        return;
      }
      router.push("/dashboard");
    } catch {
      setErr(t("failed"));
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <FormField id="username" label={t("username")}>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                minLength={3}
                maxLength={64}
                pattern="[a-zA-Z0-9_.-]+"
              />
            </FormField>
            <FormField id="password" label={t("password")} description={t("passwordHint")}>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={12}
              />
            </FormField>
            <FormField id="confirm" label={t("confirmPassword")} error={err}>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
                minLength={12}
              />
            </FormField>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
