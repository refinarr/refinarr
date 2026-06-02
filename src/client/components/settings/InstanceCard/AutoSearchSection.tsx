"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Loader2,
  PauseCircle,
} from "lucide-react";
import { Button } from "@/client/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/client/components/ui/dropdown-menu";
import {
  AutoSearchFormFields,
  type AutoSearchFields,
} from "@/client/components/settings/AutoSearchFormFields";
import {
  useAutoSearchStatus,
  useCronPreview,
  useTriggerAutoSearch,
} from "@/client/hooks/data/useAutoSearch";
import { useUpdateInstance } from "@/client/hooks/data/useInstances";
import { useDebouncedValue } from "@/client/hooks/ui/useDebouncedValue";
import {
  formatRelative,
  formatEta,
  msUntil,
} from "@/client/lib/format-relative";
import { withToast } from "@/client/lib/with-toast";
import { isCronSyntaxValid } from "@/shared/cron";
import type { PublicInstance } from "@/shared/types/api";

interface Props {
  instance: PublicInstance;
}

function nowPlusDuration(durationMs: number): string {
  return new Date(Date.now() + durationMs).toISOString();
}

const PAUSE_DURATIONS_MS = [
  { labelKey: "pause1h" as const, ms: 60 * 60 * 1000 },
  { labelKey: "pause6h" as const, ms: 6 * 60 * 60 * 1000 },
  { labelKey: "pause24h" as const, ms: 24 * 60 * 60 * 1000 },
  { labelKey: "pause7d" as const, ms: 7 * 24 * 60 * 60 * 1000 },
] as const;

function fieldsFromInstance(i: PublicInstance): AutoSearchFields {
  return {
    autoSearchEnabled: i.autoSearchEnabled,
    autoSearchScheduleMode: i.autoSearchScheduleMode,
    autoSearchIntervalMinutes: i.autoSearchIntervalMinutes,
    autoSearchCronExpression: i.autoSearchCronExpression,
    autoSearchBatchLimit: i.autoSearchBatchLimit,
    autoSearchMonitoredOnly: i.autoSearchMonitoredOnly,
    autoSearchScope: i.autoSearchScope,
    autoSearchPickStrategy: i.autoSearchPickStrategy,
    autoSearchCooldownHours: i.autoSearchCooldownHours,
  };
}

export function AutoSearchSection({ instance }: Props) {
  const t = useTranslations("settings.autoSearch");
  const tCommon = useTranslations("common");
  const tTime = useTranslations("time");
  const tToast = useTranslations("toast.instance");
  const [open, setOpen] = useState(instance.autoSearchEnabled);
  const [localFields, setLocalFields] = useState<AutoSearchFields>(() =>
    fieldsFromInstance(instance),
  );
  const debouncedFields = useDebouncedValue(localFields, 500);
  const isFirstRender = useRef(true);

  const { data: status, isLoading } = useAutoSearchStatus(instance.id);
  const trigger = useTriggerAutoSearch(instance.id);
  const update = useUpdateInstance();

  // useCronPreview is also called inside AutoSearchFormFields with the same key —
  // TanStack Query deduplicates the network request. We call it here so we can
  // guard auto-save without waiting for the form to surface the error.
  const cronPreview = useCronPreview(localFields.autoSearchCronExpression);
  const isCronMode = debouncedFields.autoSearchScheduleMode === "cron";
  // Syntactic gate is shared with the server (src/shared/cron.ts) so a
  // change to the alias list or field-count rule lands in both places.
  // We keep the `cronPreview.isError` check separately because it
  // catches semantic errors (out-of-range fields, unreachable schedules)
  // that the syntactic check can't see.
  const isCronValid =
    !isCronMode ||
    (isCronSyntaxValid(debouncedFields.autoSearchCronExpression) &&
      !cronPreview.isError);

  // Auto-save whenever debouncedFields change (skip on mount).
  // Skip save when the cron expression is known-invalid to avoid storing bad data.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!isCronValid) return;
    void update.mutateAsync({ id: instance.id, data: debouncedFields });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedFields]);

  const runTrigger = withToast(trigger, {
    success: tToast("updated"),
    error: tToast("updateFailed"),
  });
  const pauseUpdate = withToast(update, {
    success: tToast("updated"),
    error: tToast("updateFailed"),
  });

  const setPause = (durationMs: number) => {
    void pauseUpdate({
      id: instance.id,
      data: { autoSearchPausedUntil: nowPlusDuration(durationMs) },
    });
  };

  const clearPause = () => {
    void pauseUpdate({
      id: instance.id,
      data: { autoSearchPausedUntil: null },
    });
  };

  const lastRunAt = status?.lastRunAt ?? null;
  const nextRunAt = status?.nextRunAt ?? null;
  const running = status?.running ?? false;
  const paused = status?.paused ?? false;
  const pausedUntil = status?.pausedUntil ?? null;

  const lastRunDisplay = lastRunAt
    ? formatRelative(lastRunAt, tTime)
    : t("lastRunNever");
  const nextRunDisplay = useMemo(
    () => (nextRunAt ? formatEta(msUntil(nextRunAt), tTime) : null),
    [nextRunAt, tTime],
  );
  const pausedUntilDisplay = useMemo(
    () => (pausedUntil ? formatRelative(pausedUntil, tTime) : null),
    [pausedUntil, tTime],
  );

  let closedSummary: string;
  if (paused) {
    closedSummary = t("pausedLabel");
  } else if (localFields.autoSearchEnabled) {
    closedSummary = tCommon("on");
  } else {
    closedSummary = tCommon("off");
  }

  // "enabled but unscheduled" — server has the instance set to cron
  // mode with a syntactically invalid expression. The runner sits idle
  // and never logs again until the user edits the instance, so without
  // this banner the UI shows a stale "Last run …" with no hint that
  // automation is broken.
  const cronUnschedulable =
    localFields.autoSearchEnabled &&
    localFields.autoSearchScheduleMode === "cron" &&
    status !== undefined &&
    status.cronValid === false;

  let runStatus;
  if (paused) {
    runStatus = (
      <span className="text-warning flex items-center gap-1">
        <PauseCircle className="size-3" />
        {t("pausedUntil", { time: pausedUntilDisplay ?? "…" })}
      </span>
    );
  } else if (running) {
    runStatus = (
      <span className="text-brand flex items-center gap-1">
        <Loader2 className="size-3 animate-spin" />
        {t("runningNow")}
      </span>
    );
  } else if (cronUnschedulable) {
    runStatus = (
      <span className="text-warning flex items-center gap-1">
        <AlertTriangle className="size-3" />
        {t("cronUnscheduled")}
      </span>
    );
  } else {
    runStatus = (
      <span>
        {t("lastRun")}: {lastRunDisplay}
        {nextRunDisplay && (
          <>
            {" "}
            · {t("nextRun")}: {t("nextRunIn", { eta: nextRunDisplay })}
          </>
        )}
      </span>
    );
  }

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
        {t("sectionTitle")}
        {!open && (
          <span className="text-muted-foreground ml-auto font-normal">
            {closedSummary}
          </span>
        )}
      </button>

      {open && (
        <div className="flex flex-col gap-4 py-2">
          <AutoSearchFormFields
            value={localFields}
            onChange={(next) =>
              setLocalFields((prev) => ({ ...prev, ...next }))
            }
          />

          {localFields.autoSearchEnabled && !isLoading && (
            <div className="flex items-center justify-between gap-2">
              <div className="text-muted-foreground text-xs">{runStatus}</div>

              <div className="flex items-center gap-2">
                {paused ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={update.isPending}
                    onClick={clearPause}
                  >
                    {t("resume")}
                  </Button>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="hover:bg-accent inline-flex size-7 items-center justify-center rounded-md text-sm disabled:pointer-events-none disabled:opacity-50"
                      disabled={running || update.isPending}
                      aria-label={t("pauseMenu")}
                    >
                      <PauseCircle className="size-3.5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {PAUSE_DURATIONS_MS.map(({ labelKey, ms }) => (
                        <DropdownMenuItem
                          key={labelKey}
                          onClick={() => setPause(ms)}
                        >
                          {t(labelKey)}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  disabled={
                    paused || running || trigger.isPending || !isCronValid
                  }
                  onClick={() => runTrigger()}
                >
                  {trigger.isPending && (
                    <Loader2 className="mr-1 size-3 animate-spin" />
                  )}
                  {t("runNow")}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
