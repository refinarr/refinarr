"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { useMe } from "@/client/hooks/useMe";

export function PasswordChangeCard() {
  const t = useTranslations("auth.password");
  const { data: me } = useMe();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Reverse-proxy users manage their password elsewhere — hide the card.
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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="current-password">{t("currentPassword")}</Label>
            <Input
              id="current-password"
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-password">{t("newPassword")}</Label>
            <Input
              id="new-password"
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
              required
              minLength={12}
            />
            <p className="text-xs text-muted-foreground">{t("newPasswordHint")}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm-new-password">{t("confirmNewPassword")}</Label>
            <Input
              id="confirm-new-password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
              minLength={12}
            />
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <Button type="submit" disabled={submitting}>
            {t("submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
