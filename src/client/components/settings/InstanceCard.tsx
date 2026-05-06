"use client";
import { useTranslations } from "next-intl";
import { Edit2, Trash2, Plug, Hourglass } from "lucide-react";
import { Card, CardContent } from "@/client/components/ui/card";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import {
  useDeleteInstance,
  useTestConnection,
} from "@/client/hooks/data/useInstances";
import { usePreferences } from "@/client/hooks/data/usePreferences";
import { useSearchQueue } from "@/client/hooks/data/useSearchQueue";
import { withToast } from "@/client/lib/with-toast";
import { formatEta } from "@/client/lib/format-relative";
import type { Instance } from "@/shared/types/models";

interface Props {
  instance: Instance;
  failedCount?: number;
  onEdit: () => void;
}

export function InstanceCard({ instance, failedCount = 0, onEdit }: Props) {
  const t = useTranslations("settings");
  const tForm = useTranslations("settings.instanceForm");
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

  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-4">
        <Badge variant="outline" className="capitalize">
          {instance.type}
        </Badge>
        <div className="flex-1">
          <p className="font-medium">{instance.name}</p>
          <p className="text-muted-foreground text-xs">{instance.url}</p>
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
          <Badge variant="destructive">{failedCount} failed</Badge>
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
      </CardContent>
    </Card>
  );
}
