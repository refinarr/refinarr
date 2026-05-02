"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Switch } from "@/client/components/ui/switch";
import { Label } from "@/client/components/ui/label";
import { Badge } from "@/client/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/client/components/ui/dialog";
import { Button } from "@/client/components/ui/button";
import { useConfig, useUpdateConfig } from "@/client/hooks/useConfig";
import { toast } from "sonner";

export function DryRunToggle() {
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

  return (
    <>
      <div className="flex items-center gap-4">
        <Switch checked={isDryRun} onCheckedChange={handleToggle} />
        <Label>{t("label")}</Label>
        <Badge variant={isDryRun ? "outline" : "destructive"}>
          {isDryRun ? t("badgeOn") : t("badgeOff")}
        </Badge>
      </div>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("switchTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("switchBody")}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>{tCommon("cancel")}</Button>
            <Button variant="destructive" onClick={goLive}>{t("switchConfirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
