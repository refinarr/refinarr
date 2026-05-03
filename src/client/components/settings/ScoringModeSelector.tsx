"use client";
import { useTranslations } from "next-intl";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/client/components/ui/select";
import { Label } from "@/client/components/ui/label";
import { useConfig, useUpdateConfig } from "@/client/hooks/data/useConfig";
import { toast } from "sonner";

interface Props {
  instanceId: number;
  // Compact mode drops the inline "Scoring Mode" label and shrinks the
  // trigger so the selector fits inline with other status-bar controls.
  compact?: boolean;
}

export function ScoringModeSelector({ instanceId, compact = false }: Props) {
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

  const select = (
    <Select value={mode} onValueChange={(v) => { if (v) handleChange(v); }}>
      <SelectTrigger className={compact ? "h-7 w-auto gap-1.5 border-none bg-transparent px-2 text-sm font-medium hover:bg-primary/10 focus:ring-0" : "w-36"}>
        <SelectValue>{t(`scoringModeOptions.${mode as "manual" | "profile"}`)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="manual">{t("scoringModeOptions.manual")}</SelectItem>
        <SelectItem value="profile">{t("scoringModeOptions.profile")}</SelectItem>
      </SelectContent>
    </Select>
  );

  if (compact) return select;

  return (
    <div className="flex items-center gap-3">
      <Label>{t("scoringMode")}</Label>
      {select}
    </div>
  );
}
