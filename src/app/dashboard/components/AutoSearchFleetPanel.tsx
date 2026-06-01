"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AlertTriangle, Loader2, PauseCircle, Play } from "lucide-react";
import { Button } from "@/client/components/ui/button";
import {
  useAutoSearchStatuses,
  useTriggerAutoSearch,
} from "@/client/hooks/data/useAutoSearch";
import { useUpdateInstance } from "@/client/hooks/data/useInstances";
import {
  formatRelative,
  formatEta,
  msUntil,
} from "@/client/lib/format-relative";
import { withToast } from "@/client/lib/with-toast";
import type {
  AutoSearchStatus,
  DashboardInstanceSummary,
} from "@/shared/types/api";

interface RowProps {
  instance: DashboardInstanceSummary;
  status: AutoSearchStatus | undefined;
}

function FleetRow({ instance, status }: RowProps) {
  const tTime = useTranslations("time");
  const tToast = useTranslations("toast.instance");
  const t = useTranslations("dashboard.fleet");

  const trigger = useTriggerAutoSearch(instance.id);
  const update = useUpdateInstance();

  const runTrigger = withToast(trigger, {
    success: tToast("updated"),
    error: tToast("updateFailed"),
  });
  const resume = withToast(update, {
    success: tToast("updated"),
    error: tToast("updateFailed"),
  });

  const clearPause = () => {
    void resume({ id: instance.id, data: { autoSearchPausedUntil: null } });
  };

  const running = status?.running ?? false;
  const paused = status?.paused ?? false;
  const pausedUntil = status?.pausedUntil ?? null;
  const lastRunAt = status?.lastRunAt ?? null;
  const nextRunAt = status?.nextRunAt ?? null;
  const overdue = status?.overdue ?? false;
  const failedStreak = status?.failedStreak ?? 0;
  const health = status?.health ?? "ok";

  let statusContent;
  if (health === "critical") {
    // Critical wins over running/paused/overdue because it represents
    // accumulated failures the user needs to investigate; rendering
    // "Running…" or "Paused" would mask the alert.
    statusContent = (
      <span className="text-critical inline-flex items-center gap-1">
        <AlertTriangle className="size-3" />
        {t("failedStreak", { count: failedStreak })}
      </span>
    );
  } else if (paused && pausedUntil) {
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
  } else if (overdue && nextRunAt) {
    statusContent = (
      <span className="text-warning inline-flex items-center gap-1">
        {t("overdue", { eta: formatEta(-msUntil(nextRunAt), tTime) })}
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
        <Link
          href={`/logs?source=auto-run&instanceId=${instance.id}`}
          className="text-muted-foreground hover:text-foreground inline-flex items-center px-2 text-xs underline-offset-2 hover:underline pointer-coarse:min-h-11"
        >
          {t("viewRuns")}
        </Link>
        {paused && (
          <Button
            size="sm"
            variant="ghost"
            className="px-2 text-xs"
            disabled={update.isPending}
            onClick={clearPause}
          >
            {t("resume")}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="px-2"
          disabled={paused || running || trigger.isPending}
          onClick={() => runTrigger()}
          aria-label={t("runNow")}
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
  const { data: statuses } = useAutoSearchStatuses();
  const autoSearchInstances = instances.filter((i) => i.autoSearchEnabled);
  if (autoSearchInstances.length === 0) return null;

  return (
    <div>
      <h2 className="mb-2 text-lg font-semibold">{t("title")}</h2>
      <div className="bg-card divide-border divide-y rounded-lg border px-4">
        {autoSearchInstances.map((inst) => (
          <FleetRow
            key={inst.id}
            instance={inst}
            status={statuses?.[inst.id]}
          />
        ))}
      </div>
    </div>
  );
}
