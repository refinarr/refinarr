"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/client/components/ui/button";
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
import { formatRelative, formatEta } from "@/client/lib/format-relative";
import { withToast } from "@/client/lib/with-toast";
import type { PublicInstance } from "@/shared/types/api";

interface Props {
  instance: PublicInstance;
}

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

  const lastRunAt = status?.lastRunAt ?? null;
  const nextRunAt = status?.nextRunAt ?? null;
  const running = status?.running ?? false;

  const lastRunDisplay = lastRunAt
    ? formatRelative(lastRunAt, tTime)
    : t("lastRunNever");
  const nextRunDisplay = nextRunAt
    ? formatEta(Math.max(0, new Date(nextRunAt).getTime() - Date.now()), tTime)
    : null;

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
            {localFields.autoSearchEnabled ? tCommon("on") : tCommon("off")}
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
            <div className="flex items-center justify-between">
              <div className="text-muted-foreground text-xs">
                {running ? (
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
              <Button
                size="sm"
                variant="outline"
                disabled={running || trigger.isPending}
                onClick={() => runTrigger()}
              >
                {trigger.isPending && (
                  <Loader2 className="mr-1 size-3 animate-spin" />
                )}
                {t("runNow")}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
