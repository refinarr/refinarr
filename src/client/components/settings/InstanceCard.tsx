"use client";
import { useTranslations } from "next-intl";
import { Edit2, Trash2, Plug, Hourglass } from "lucide-react";
import { Card, CardContent } from "@/client/components/ui/card";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { ShowAllMediaToggle } from "@/client/components/settings/ShowAllMediaToggle";
import { ScoringModeSection } from "@/client/components/settings/InstanceCard/ScoringModeSection";
import { AutoSearchSection } from "@/client/components/settings/InstanceCard/AutoSearchSection";
import {
  useDeleteInstance,
  useTestConnection,
} from "@/client/hooks/data/useInstances";
import { usePreferences } from "@/client/hooks/data/usePreferences";
import { useSearchQueue } from "@/client/hooks/data/useSearchQueue";
import { withToast } from "@/client/lib/with-toast";
import { formatEta } from "@/client/lib/format-relative";
import { isProfileMode } from "@/shared/scoring-mode";
import type { PublicInstance } from "@/shared/types/api";

interface Props {
  instance: PublicInstance;
  failedCount?: number;
  onEdit: () => void;
}

export function InstanceCard({ instance, failedCount = 0, onEdit }: Props) {
  const t = useTranslations("settings");
  const tForm = useTranslations("settings.instanceForm");
  const tAutoSearch = useTranslations("settings.autoSearch");
  const tToast = useTranslations("toast.instance");
  const tCommon = useTranslations("common");
  const tTime = useTranslations("time");
  const deleteInstance = useDeleteInstance();
  const test = useTestConnection();
  const { data: prefs } = usePreferences(instance.id);
  const { data: queue } = useSearchQueue(instance.id);
  const noCfs = (prefs?.length ?? 0) === 0 && instance.enabled;
  const pendingCount = queue?.pendingCount ?? 0;

  const runTest = withToast(test, {
    success: tToast("testOk", { name: instance.name }),
    error: tToast("testFailed", { name: instance.name }),
  });
  const runDelete = withToast(deleteInstance, {
    success: tToast("deleted"),
    error: tToast("deleteFailed"),
  });

  const handleTest = () => runTest(instance.id);
  const handleDelete = () => runDelete(instance.id);

  // CF summary line — up to 3 tags then "+N more"
  const MAX_CF_DISPLAY = 3;
  const cfTags = prefs ?? [];
  const visibleCfs = cfTags.slice(0, MAX_CF_DISPLAY);
  const overflowCfs = cfTags.length - MAX_CF_DISPLAY;

  const scoringModeLabel = isProfileMode(instance.scoringMode)
    ? tAutoSearch("scoringModeProfile")
    : tAutoSearch("scoringModeManual");

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="capitalize">
            {instance.type}
          </Badge>
          <div className="min-w-0 flex-1">
            <p className="font-medium">{instance.name}</p>
            <p className="text-muted-foreground truncate text-xs">
              {instance.url}
            </p>
            <p className="text-muted-foreground text-xs">
              {scoringModeLabel} · {instance.searchesPerHour}
              {tForm("searchesPerHourSuffix")}
              {visibleCfs.length > 0 && (
                <>
                  {" · "}
                  {visibleCfs.map((cf) => cf.cfName).join(" · ")}
                  {overflowCfs > 0 && (
                    <> · {tCommon("moreCount", { count: overflowCfs })}</>
                  )}
                </>
              )}
            </p>
            {noCfs && (
              <p className="text-warning mt-0.5 text-xs">
                {t("noCfsConfigured")}
              </p>
            )}
          </div>
          {pendingCount > 0 && (
            <Badge
              variant="outline"
              title={tForm("queuedBadgeTooltip", {
                count: pendingCount,
                eta: formatEta(queue?.etaMs ?? 0, tTime),
              })}
              className="gap-1"
            >
              <Hourglass className="size-3" />
              {tForm("queuedBadge", { count: pendingCount })}
            </Badge>
          )}
          {failedCount > 0 && (
            <Badge variant="destructive">
              {failedCount} {tForm("failedBadge")}
            </Badge>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleTest}
              disabled={test.isPending}
              aria-label={tCommon("test")}
            >
              <Plug className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={onEdit}
              aria-label={tCommon("edit")}
            >
              <Edit2 className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleDelete}
              disabled={deleteInstance.isPending}
              aria-label={tCommon("delete")}
            >
              <Trash2 className="text-destructive size-4" />
            </Button>
          </div>
        </div>
        <div className="pt-subgroup border-t">
          <ShowAllMediaToggle instanceId={instance.id} />
        </div>
        <div className="pt-subgroup border-t">
          <ScoringModeSection instance={instance} />
        </div>
        <div className="pt-subgroup border-t">
          <AutoSearchSection instance={instance} />
        </div>
      </CardContent>
    </Card>
  );
}
