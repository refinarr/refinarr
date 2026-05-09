"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronRight, Loader2, PauseCircle } from "lucide-react";
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
import type { PublicInstance } from "@/shared/types/api";

interface Props {
  instance: PublicInstance;
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
    autoSearchScoringMode: i.autoSearchScoringMode,
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

  // Auto-save whenever debouncedFields change (skip on mount).
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    void update.mutateAsync({ id: instance.id, data: debouncedFields });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedFields]);

  const runTrigger = withToast(trigger, {
    success: tToast("updated"),
    error: tToast("updateFailed"),
  });

  const setPause = (durationMs: number) => {
    const until = new Date(Date.now() + durationMs).toISOString();
    void update.mutateAsync({
      id: instance.id,
      data: { autoSearchPausedUntil: until },
    });
  };

  const clearPause = () => {
    void update.mutateAsync({
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
            {paused
              ? t("pausedLabel")
              : localFields.autoSearchEnabled
                ? tCommon("on")
                : tCommon("off")}
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
            disabled={update.isPending}
          />

          {localFields.autoSearchEnabled && !isLoading && (
            <div className="flex items-center justify-between gap-2">
              <div className="text-muted-foreground text-xs">
                {paused ? (
                  <span className="text-warning flex items-center gap-1">
                    <PauseCircle className="size-3" />
                    {t("pausedUntil", { time: pausedUntilDisplay ?? "…" })}
                  </span>
                ) : running ? (
                  <span className="text-brand flex items-center gap-1">
                    <Loader2 className="size-3 animate-spin" />
                    {t("runningNow")}
                  </span>
                ) : (
                  <span>
                    {t("lastRun")}: {lastRunDisplay}
                    {nextRunDisplay && (
                      <>
                        {" "}
                        · {t("nextRun")}: in {nextRunDisplay}
                      </>
                    )}
                  </span>
                )}
              </div>

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
                    >
                      <PauseCircle className="size-3.5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {PAUSE_DURATIONS_MS.map(({ labelKey, ms }) => (
                        <DropdownMenuItem
                          key={labelKey}
                          onSelect={() => setPause(ms)}
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
                  disabled={paused || running || trigger.isPending}
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
