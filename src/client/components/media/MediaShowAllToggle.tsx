"use client";
import { useTranslations } from "next-intl";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/client/components/ui/button";
import {
  useInstances,
  useUpdateInstance,
} from "@/client/hooks/data/useInstances";
import { withToast } from "@/client/lib/with-toast";

interface Props {
  instanceId: number;
}

// Compact list-header control to flip "show all media" vs "flagged only"
// without diving into Settings (GAP-1 in the QA report). It flips the persisted
// per-instance `showAllMedia` setting — the server gates flaggedOnly on it, so a
// pure view filter wouldn't surface non-flagged items. useMediaFilters re-syncs
// the active flaggedOnly filter when this setting changes.
export function MediaShowAllToggle({ instanceId }: Props) {
  const t = useTranslations("common");
  const tToast = useTranslations("toast");
  const { data: instances } = useInstances();
  const update = useUpdateInstance();
  const showAll =
    instances?.find((i) => i.id === instanceId)?.showAllMedia ?? false;

  const toggle = async () => {
    const apply = withToast(update, {
      success: tToast(showAll ? "showAllMediaOff" : "showAllMediaOn"),
      error: tToast("instance.updateFailed"),
    });
    await apply({ id: instanceId, data: { showAllMedia: !showAll } });
  };

  const label = showAll ? t("viewShowAll") : t("viewFlaggedOnly");
  return (
    <Button
      variant="ghost"
      size="icon-touch"
      onClick={toggle}
      disabled={update.isPending}
      title={`${label} — ${t("viewToggleHint")}`}
      aria-label={label}
      aria-pressed={showAll}
    >
      {showAll ? <Eye /> : <EyeOff />}
    </Button>
  );
}
