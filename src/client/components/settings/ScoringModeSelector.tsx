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
  // Compact mode drops the inline "Scoring Mode" label and shrinks the
  // trigger so the selector fits inline with other status-bar controls.
  compact?: boolean;
}

export function ScoringModeSelector({ instanceId, compact = false }: Props) {
  const t = useTranslations("settings");
  const tToast = useTranslations("toast");
  const { data: instances } = useInstances();
  const updateInstance = useUpdateInstance();
  const mode =
    instances?.find((i) => i.id === instanceId)?.scoringMode ??
    DEFAULT_SCORING_MODE;

  const handleChange = async (value: string) => {
    if (!isScoringMode(value)) return;
    const scoringMode = value;
    const updateScoringMode = withToast(updateInstance, {
      success: tToast("scoringMode", {
        mode: t(`scoringModeOptions.${scoringMode}`),
      }),
    });

    await updateScoringMode({
      id: instanceId,
      data: { scoringMode },
    });
  };

  const select = (
    <Select
      value={mode}
      onValueChange={(v) => {
        if (v) handleChange(v);
      }}
    >
      <SelectTrigger
        className={
          compact
            ? "hover:bg-primary/10 h-7 w-auto gap-1.5 border-none bg-transparent px-2 text-sm font-medium focus:ring-0"
            : "w-36"
        }
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

  if (compact) return select;

  return (
    <div className="flex items-center gap-3">
      <Label>{t("scoringMode")}</Label>
      {select}
    </div>
  );
}
