"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Switch } from "@/client/components/ui/switch";
import { Label } from "@/client/components/ui/label";
import { Badge } from "@/client/components/ui/badge";
import { Card } from "@/client/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/client/components/ui/dialog";
import { Button } from "@/client/components/ui/button";
import { useConfig, useUpdateConfig } from "@/client/hooks/data/useConfig";
import { cn } from "@/client/lib/utils";
import { toast } from "sonner";
import { AlertTriangle, ShieldCheck } from "lucide-react";

interface Props {
  // When true, render inside a prominent Card with state-aware styling
  // (warning border when live mode is on). Used at the top of /settings.
  prominent?: boolean;
}

export function DryRunToggle({ prominent = false }: Props) {
  const t = useTranslations("settings.dryRun");
  const tToast = useTranslations("toast.dryRun");
  const tCommon = useTranslations("common");
  const { data: config } = useConfig();
  const updateConfig = useUpdateConfig();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isDryRun = config?.dryRun ?? true;

  const handleToggle = (checked: boolean) => {
    if (!checked) {
      setConfirmOpen(true);
    } else {
      updateConfig.mutate({ dryRun: "true" });
      toast.info(tToast("enabled"));
    }
  };

  const goLive = async () => {
    await updateConfig.mutateAsync({ dryRun: "false" });
    toast.warning(tToast("disabled"));
    setConfirmOpen(false);
  };

  const row = (
    <div className="flex items-center gap-4">
      <Switch checked={isDryRun} onCheckedChange={handleToggle} />
      <Label>{t("label")}</Label>
      <Badge variant={isDryRun ? "outline" : "destructive"}>
        {isDryRun ? t("badgeOn") : t("badgeOff")}
      </Badge>
    </div>
  );

  return (
    <>
      {prominent ? (
        <Card
          className={cn(
            "p-4 transition-colors",
            !isDryRun && "border-destructive/40 bg-destructive/5",
          )}
        >
          <div className="flex items-start gap-3">
            {isDryRun ? (
              <ShieldCheck
                className="h-5 w-5 mt-0.5 shrink-0 text-emerald-400"
                aria-hidden
              />
            ) : (
              <AlertTriangle
                className="h-5 w-5 mt-0.5 shrink-0 text-destructive"
                aria-hidden
              />
            )}
            <div className="flex-1 space-y-2">
              <div>
                <p className="font-medium">
                  {isDryRun ? t("prominentTitleDry") : t("prominentTitleLive")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isDryRun ? t("prominentBodyDry") : t("prominentBodyLive")}
                </p>
              </div>
              {row}
            </div>
          </div>
        </Card>
      ) : (
        row
      )}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("switchTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("switchBody")}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button variant="destructive" onClick={goLive}>
              {t("switchConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
