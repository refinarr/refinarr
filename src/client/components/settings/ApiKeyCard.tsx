"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { FormField } from "@/client/components/ui/form-field";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/client/components/ui/dialog";
import { Copy, Eye, EyeOff, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type Action = "reveal" | "rotate";

export function ApiKeyCard() {
  const t = useTranslations("settings");
  const tk = useTranslations("settings.apiKey");
  const tCommon = useTranslations("common");
  const tLogin = useTranslations("auth.login");

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

  const submit = async (e: React.FormEvent) => {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("apiAccess")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{tk("description")}</p>
        <div className="flex items-center gap-2">
          <Input
            readOnly
            type="text"
            value={revealed ?? "••••••••••••••••••••••••••••••••"}
            className="font-mono text-sm"
          />
          {revealed ? (
            <>
              <Button variant="outline" size="icon" onClick={hide} aria-label={tk("hide")}>
                <EyeOff className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={copy} aria-label={tk("copy")}>
                <Copy className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => ask("reveal")}>
              <Eye className="h-4 w-4 mr-1" /> {tk("reveal")}
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={() => ask("rotate")} aria-label={tk("rotate")}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>

      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tk("passwordPrompt")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <FormField id="apikey-password" label={tLogin("password")} error={pwErr}>
              <Input
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                autoComplete="current-password"
                autoFocus
                required
              />
            </FormField>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPwOpen(false)}>
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {pending === "rotate" ? tk("rotate") : tk("reveal")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
