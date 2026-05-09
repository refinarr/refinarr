"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import { CfPreferencePicker } from "@/client/components/settings/CfPreferencePicker";
import { useUpdateInstance } from "@/client/hooks/data/useInstances";
import { withToast } from "@/client/lib/with-toast";
import {
  ALL_SCORING_MODES,
  isManualMode,
  isScoringMode,
} from "@/shared/scoring-mode";
import type { PublicInstance } from "@/shared/types/api";

interface Props {
  instance: PublicInstance;
}

export function ScoringModeSection({ instance }: Props) {
  const t = useTranslations("settings");
  const tToast = useTranslations("toast");
  const [open, setOpen] = useState(false);
  const updateInstance = useUpdateInstance();

  const mode = instance.scoringMode;

  const handleChange = async (value: string | null) => {
    if (!value || !isScoringMode(value)) return;
    const updateScoringMode = withToast(updateInstance, {
      success: tToast("scoringMode", {
        mode: t(`scoringModeOptions.${value}`),
      }),
    });
    await updateScoringMode({ id: instance.id, data: { scoringMode: value } });
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 py-2 text-sm font-medium"
      >
        {open ? (
          <ChevronDown className="size-4" />
        ) : (
          <ChevronRight className="size-4" />
        )}
        {t("scoringMode")}
        {!open && (
          <span className="text-muted-foreground ml-auto font-normal">
            {t(`scoringModeOptions.${mode}`)}
          </span>
        )}
      </button>

      {open && (
        <div className="space-y-4 pb-2">
          <Select value={mode} onValueChange={handleChange}>
            <SelectTrigger className="w-36">
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

          {isManualMode(mode) && <CfPreferencePicker instance={instance} />}
        </div>
      )}
    </div>
  );
}
