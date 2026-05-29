"use client";
import { useTranslations } from "next-intl";
import { Switch } from "@/client/components/ui/switch";
import { Label } from "@/client/components/ui/label";
import { useConfig, useUpdateConfig } from "@/client/hooks/data/useConfig";
import { withToast } from "@/client/lib/with-toast";

export function DebugModeToggle() {
  const t = useTranslations("settings.debugMode");
  const tToast = useTranslations("toast.debugMode");
  const { data: config } = useConfig();
  const updateConfig = useUpdateConfig();

  const isDebug = config?.debugMode ?? false;

  const toggle = (checked: boolean) =>
    withToast(updateConfig, {
      success: tToast(checked ? "enabled" : "disabled"),
    })({ debugMode: String(checked) });

  return (
    <div className="flex items-center gap-4">
      <Switch id="debug-mode" checked={isDebug} onCheckedChange={toggle} />
      <div>
        <Label htmlFor="debug-mode">{t("label")}</Label>
        <p className="text-muted-foreground text-xs">{t("helper")}</p>
      </div>
    </div>
  );
}
