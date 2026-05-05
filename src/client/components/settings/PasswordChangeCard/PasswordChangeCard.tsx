"use client";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { FormField } from "@/client/components/ui/form-field";
import { Loader2 } from "lucide-react";
import { useMe } from "@/client/hooks/data/useMe";
import { usePasswordChangeForm } from "./usePasswordChangeForm";

export function PasswordChangeCard() {
  const t = useTranslations("auth.password");
  const { data: me } = useMe();
  const {
    current, setCurrent,
    next, setNext,
    confirm, setConfirm,
    submitting,
    err,
    submit,
  } = usePasswordChangeForm();

  if (me?.source !== "session") return null;

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
