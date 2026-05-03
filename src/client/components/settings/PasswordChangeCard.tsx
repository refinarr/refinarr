"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { FormField } from "@/client/components/ui/form-field";
import { useMe } from "@/client/hooks/data/useMe";
import { Loader2 } from "lucide-react";

export function PasswordChangeCard() {
  const t = useTranslations("auth.password");
  const { data: me } = useMe();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (me?.source !== "session") return null;

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
        if (body?.error === "New password must differ from current") {
          setErr(t("sameAsCurrent"));
        } else {
          setErr(t("failed"));
        }
        setSubmitting(false);
        return;
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      setSubmitting(false);
      toast.success(t("changed"));
    } catch {
      setErr(t("failed"));
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">{t("description")}</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4 max-w-md">
          <FormField id="current-password" label={t("currentPassword")}>
            <Input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              required
            />
          </FormField>
          <FormField id="new-password" label={t("newPassword")} description={t("newPasswordHint")}>
            <Input
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
              required
              minLength={12}
            />
          </FormField>
          <FormField id="confirm-new-password" label={t("confirmNewPassword")} error={err}>
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
              minLength={12}
            />
          </FormField>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
