"use client";
import { useTranslations } from "next-intl";
import { Loader2, PauseCircle, Play } from "lucide-react";
import { Button } from "@/client/components/ui/button";
import {
  useAutoSearchStatus,
  useTriggerAutoSearch,
} from "@/client/hooks/data/useAutoSearch";
import { useUpdateInstance } from "@/client/hooks/data/useInstances";
import {
  formatRelative,
  formatEta,
  msUntil,
} from "@/client/lib/format-relative";
import { withToast } from "@/client/lib/with-toast";
import type { DashboardInstanceSummary } from "@/shared/types/api";

interface RowProps {
  instance: DashboardInstanceSummary;
}

function FleetRow({ instance }: RowProps) {
  const tTime = useTranslations("time");
  const tToast = useTranslations("toast.instance");
  const t = useTranslations("dashboard.fleet");

  const { data: status } = useAutoSearchStatus(instance.id);
  const trigger = useTriggerAutoSearch(instance.id);
  const update = useUpdateInstance();

  const runTrigger = withToast(trigger, {
    success: tToast("updated"),
    error: tToast("updateFailed"),
  });

  const clearPause = () => {
    void update.mutateAsync({
      id: instance.id,
      data: { autoSearchPausedUntil: null },
    });
  };

  const running = status?.running ?? false;
  const paused = status?.paused ?? false;
  const pausedUntil = status?.pausedUntil ?? null;
  const lastRunAt = status?.lastRunAt ?? null;
  const nextRunAt = status?.nextRunAt ?? null;

  let statusContent;
  if (paused && pausedUntil) {
    statusContent = (
      <span className="text-warning inline-flex items-center gap-1">
        <PauseCircle className="size-3" />
        {t("pausedUntil", { time: formatRelative(pausedUntil, tTime) })}
      </span>
    );
  } else if (running) {
    statusContent = (
      <span className="text-brand inline-flex items-center gap-1">
        <Loader2 className="size-3 animate-spin" />
        {t("running")}
      </span>
    );
  } else {
    statusContent = (
      <>
        {lastRunAt
          ? t("lastRun", { time: formatRelative(lastRunAt, tTime) })
          : t("neverRun")}
        {nextRunAt && !paused && (
          <> · {t("nextRun", { eta: formatEta(msUntil(nextRunAt), tTime) })}</>
        )}
      </>
    );
  }

  return (
    <div className="flex items-center gap-3 py-2 text-sm">
      <div className="min-w-0 flex-1">
        <span className="font-medium">{instance.name}</span>
        <span className="text-muted-foreground ml-2 text-xs">
          {statusContent}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {paused && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            disabled={update.isPending}
            onClick={clearPause}
          >
            {t("resume")}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2"
          disabled={paused || running || trigger.isPending}
          onClick={() => runTrigger()}
          title={t("runNow")}
        >
          {trigger.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Play className="size-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}

interface Props {
  instances: DashboardInstanceSummary[];
}

export function AutoSearchFleetPanel({ instances }: Props) {
  const t = useTranslations("dashboard.fleet");
  const autoSearchInstances = instances.filter((i) => i.autoSearchEnabled);
  if (autoSearchInstances.length === 0) return null;

  return (
    <div>
      <h2 className="mb-2 text-lg font-semibold">{t("title")}</h2>
      <div className="bg-card divide-border divide-y rounded-lg border px-4">
        {autoSearchInstances.map((inst) => (
          <FleetRow key={inst.id} instance={inst} />
        ))}
      </div>
    </div>
  );
}
