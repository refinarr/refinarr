"use client";
import { useTranslations } from "next-intl";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/client/components/ui/select";
import { Label } from "@/client/components/ui/label";
import { useConfig, useUpdateConfig } from "@/client/hooks/useConfig";
import { toast } from "sonner";

interface Props {
  instanceId: number;
}

export function ScoringModeSelector({ instanceId }: Props) {
  const t = useTranslations("settings");
  const tToast = useTranslations("toast");
  const { data: config } = useConfig();
  const updateConfig = useUpdateConfig();
  const key = `scoringMode:${instanceId}`;
  const mode = config?.scoringModes?.[key] ?? "manual";

  const handleChange = async (value: string) => {
    await updateConfig.mutateAsync({ [key]: value });
    toast.success(tToast("scoringMode", { mode: t(`scoringModeOptions.${value as "manual" | "profile"}`) }));
  };

  return (
    <div className="flex items-center gap-3">
      <Label>{t("scoringMode")}</Label>
      <Select value={mode} onValueChange={(v) => { if (v) handleChange(v); }}>
        <SelectTrigger className="w-36">
          <SelectValue>{t(`scoringModeOptions.${mode as "manual" | "profile"}`)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="manual">{t("scoringModeOptions.manual")}</SelectItem>
          <SelectItem value="profile">{t("scoringModeOptions.profile")}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
