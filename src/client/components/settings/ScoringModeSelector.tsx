"use client";
import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import { Label } from "@/client/components/ui/label";
import {
  useInstances,
  useUpdateInstance,
} from "@/client/hooks/data/useInstances";
import { withToast } from "@/client/lib/with-toast";
import {
  ALL_SCORING_MODES,
  DEFAULT_SCORING_MODE,
  isScoringMode,
} from "@/shared/scoring-mode";

interface Props {
  instanceId: number;
  // When true, render the Select alone (no leading "Scoring Mode" label).
  // The top bar uses this to save horizontal space — the current mode
  // is still visible in the SelectTrigger. Settings page leaves it false
  // so the form field keeps its descriptive label.
  hideLabel?: boolean;
}

export function ScoringModeSelector({ instanceId, hideLabel }: Props) {
  const t = useTranslations("settings");
  const tToast = useTranslations("toast");
  const { data: instances } = useInstances();
  const updateInstance = useUpdateInstance();
  const mode =
    instances?.find((i) => i.id === instanceId)?.scoringMode ??
    DEFAULT_SCORING_MODE;

  const handleChange = async (value: string | null) => {
    if (!value || !isScoringMode(value)) return;
    const updateScoringMode = withToast(updateInstance, {
      success: tToast("scoringMode", {
        mode: t(`scoringModeOptions.${value}`),
      }),
    });
    await updateScoringMode({ id: instanceId, data: { scoringMode: value } });
  };

  const select = (
    <Select value={mode} onValueChange={handleChange}>
      <SelectTrigger
        id="scoring-mode"
        aria-label={hideLabel ? t("scoringMode") : undefined}
        className="w-36"
      >
        <SelectValue>{t(`scoringModeOptions.${mode}`)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {ALL_SCORING_MODES.map((m) => (
          <SelectItem key={m} value={m}>
            {t(`scoringModeOptions.${m}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (hideLabel) return select;

  return (
    <div className="flex items-center gap-3">
      <Label htmlFor="scoring-mode">{t("scoringMode")}</Label>
      {select}
    </div>
  );
}
