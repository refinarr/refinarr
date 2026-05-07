"use client";
import { useTranslations } from "next-intl";
import { Switch } from "@/client/components/ui/switch";
import { Label } from "@/client/components/ui/label";
import {
  useInstances,
  useUpdateInstance,
} from "@/client/hooks/data/useInstances";
import { withToast } from "@/client/lib/with-toast";

interface Props {
  instanceId: number;
}

// Per-instance opt-in for "Advanced — show all media". Mirrors the
// shape of ScoringModeSelector so each instance gets its own row in
// the Instances section. Server enforces the same flag at the API
// layer (MediaService.enforceShowAllMedia), so this control only
// gates the page-level toggle visibility, not the underlying ability.
export function ShowAllMediaToggle({ instanceId }: Props) {
  const t = useTranslations("settings");
  const tToast = useTranslations("toast");
  const { data: instances } = useInstances();
  const updateInstance = useUpdateInstance();
  const value =
    instances?.find((i) => i.id === instanceId)?.showAllMedia ?? false;

  const handleChange = async (next: boolean) => {
    const apply = withToast(updateInstance, {
      success: tToast(next ? "showAllMediaOn" : "showAllMediaOff"),
      error: tToast("instance.updateFailed"),
    });
    await apply({ id: instanceId, data: { showAllMedia: next } });
  };

  const id = `show-all-media-${instanceId}`;
  return (
    <div className="flex items-start gap-3">
      <Switch
        id={id}
        checked={value}
        onCheckedChange={handleChange}
        disabled={updateInstance.isPending}
      />
      <div className="space-y-1">
        <Label htmlFor={id} className="cursor-pointer">
          {t("showAllMedia")}
        </Label>
        <p className="text-muted-foreground text-xs">{t("showAllMediaHelp")}</p>
      </div>
    </div>
  );
}
