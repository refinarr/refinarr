"use client";
import { useTranslations } from "next-intl";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/client/components/ui/select";
import { Label } from "@/client/components/ui/label";
import { useInstances, useUpdateInstance } from "@/client/hooks/data/useInstances";
import { toast } from "sonner";
import type { ScoringMode } from "@/shared/types/models";

interface Props {
  instanceId: number;
  // Compact mode drops the inline "Scoring Mode" label and shrinks the
  // trigger so the selector fits inline with other status-bar controls.
  compact?: boolean;
}

export function ScoringModeSelector({ instanceId, compact = false }: Props) {
  const t = useTranslations("settings");
  const tToast = useTranslations("toast");
  const { data: instances } = useInstances();
  const updateInstance = useUpdateInstance();
  const mode = (instances?.find((i) => i.id === instanceId)?.scoringMode ?? "profile") as ScoringMode;

  const handleChange = async (value: string) => {
    await updateInstance.mutateAsync({ id: instanceId, data: { scoringMode: value as ScoringMode } });
    toast.success(tToast("scoringMode", { mode: t(`scoringModeOptions.${value as ScoringMode}`) }));
  };

  const select = (
    <Select value={mode} onValueChange={(v) => { if (v) handleChange(v); }}>
      <SelectTrigger className={compact ? "h-7 w-auto gap-1.5 border-none bg-transparent px-2 text-sm font-medium hover:bg-primary/10 focus:ring-0" : "w-36"}>
        <SelectValue>{t(`scoringModeOptions.${mode}`)}</SelectValue>
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
