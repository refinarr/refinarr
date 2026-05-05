"use client";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { FormField } from "@/client/components/ui/form-field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/client/components/ui/dialog";
import { Copy, Eye, EyeOff, Loader2, RefreshCw } from "lucide-react";
import { useApiKeyActions } from "./useApiKeyActions";

export function ApiKeyCard() {
  const t = useTranslations("settings");
  const tk = useTranslations("settings.apiKey");
  const tCommon = useTranslations("common");
  const tLogin = useTranslations("auth.login");

  const {
    revealed,
    pending,
    pwOpen,
    setPwOpen,
    pw,
    setPw,
    pwErr,
    submitting,
    ask,
    submit,
    copy,
    hide,
  } = useApiKeyActions();

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
              <Button
                variant="outline"
                size="icon"
                onClick={hide}
                aria-label={tk("hide")}
              >
                <EyeOff className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={copy}
                aria-label={tk("copy")}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => ask("reveal")}>
              <Eye className="h-4 w-4 mr-1" /> {tk("reveal")}
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={() => ask("rotate")}
            aria-label={tk("rotate")}
          >
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
            <FormField
              id="apikey-password"
              label={tLogin("password")}
              error={pwErr}
            >
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
              <Button
                type="button"
                variant="outline"
                onClick={() => setPwOpen(false)}
              >
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {pending === "rotate" ? tk("rotate") : tk("reveal")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
