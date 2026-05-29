"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, RefreshCw, Settings } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/client/components/ui/card";
import { Badge } from "@/client/components/ui/badge";
import { Skeleton } from "@/client/components/ui/skeleton";
import { InstanceErrorSummary } from "@/client/components/history/InstanceErrorSummary";
import { useInstanceHealth } from "@/client/hooks/data/useInstances";
import { formatRelative } from "@/client/lib/format-relative";
import type { DashboardInstanceSummary } from "@/shared/types/api";
import { ARR_LIBRARY_ROUTE, ARR_META } from "@/shared/arr-meta";

interface Props {
  instance: DashboardInstanceSummary;
}

type HealthState = "disabled" | "checking" | "connected" | "unreachable";

const DOT_CLASS: Record<HealthState, string> = {
  disabled: "bg-muted-foreground",
  checking: "bg-muted-foreground animate-pulse",
  connected: "bg-ok",
  unreachable: "bg-critical",
};

// Translation key suffix under `dashboard.instanceCard.*`.
type DashboardCardKey = Parameters<
  ReturnType<typeof useTranslations<"dashboard.instanceCard">>
>[0];

const LABEL_KEY: Record<HealthState, DashboardCardKey> = {
  disabled: "disabled",
  checking: "checking",
  connected: "connected",
  unreachable: "unreachable",
};

function getHealthState(
  enabled: boolean,
  isLoading: boolean,
  healthy: boolean,
): HealthState {
  if (!enabled) return "disabled";
  if (isLoading) return "checking";
  return healthy ? "connected" : "unreachable";
}

export function InstanceSummaryCard({ instance }: Props) {
  const t = useTranslations("dashboard.instanceCard");
  const tTime = useTranslations("time");
  const {
    data: health,
    isLoading: healthLoading,
    isError: healthError,
  } = useInstanceHealth(instance.id);
  const healthy = !healthError && health?.ok === true;
  const state = getHealthState(instance.enabled, healthLoading, healthy);
  const dotClass = DOT_CLASS[state];
  const healthLabel = t(LABEL_KEY[state]);

  const libraryHref = ARR_LIBRARY_ROUTE[instance.type];
  const flaggedNounKey = ARR_META[instance.type].dashboardCardNounI18nKey;

  return (
    <Card className={!instance.enabled ? "opacity-60" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <span
            className={`size-2 rounded-full ${dotClass}`}
            title={healthLabel}
          />
          <Badge variant="outline" className="capitalize">
            {instance.type}
          </Badge>
          <span className="truncate font-medium">{instance.name}</span>
          {!instance.enabled && (
            <Badge variant="secondary">{t("disabled")}</Badge>
          )}
        </div>
        <p className="text-muted-foreground mt-1 text-xs">{healthLabel}</p>
      </CardHeader>
      <CardContent className="space-y-2">
        <Link
          href={`${libraryHref}?instanceId=${instance.id}`}
          className="bg-muted/20 hover:bg-muted/40 flex items-center justify-between rounded-md border px-3 py-2 transition-colors"
        >
          {instance.flaggedCount === null || instance.totalCount === null ? (
            <span className="flex items-center gap-2 text-sm">
              <Skeleton
                className="h-8 w-20"
                aria-label={t("flaggedOfTotalUnavailable")}
              />
              <span className="text-muted-foreground">
                {t(flaggedNounKey, { count: 0 })}
              </span>
            </span>
          ) : (
            <span className="flex items-baseline gap-1 text-sm">
              <span
                className="text-2xl font-bold tabular-nums"
                aria-label={t("flaggedOfTotal", {
                  flagged: instance.flaggedCount,
                  total: instance.totalCount,
                })}
              >
                {instance.flaggedCount}
                <span className="text-muted-foreground" aria-hidden="true">
                  {" "}
                  /{" "}
                </span>
                {instance.totalCount}
              </span>
              <span className="text-muted-foreground">
                {t(flaggedNounKey, { count: instance.flaggedCount })}
              </span>
            </span>
          )}
          <ArrowRight className="text-muted-foreground size-4" />
        </Link>

        <div className="flex items-center text-xs">
          <InstanceErrorSummary instanceId={instance.id} />
          <div className="ml-auto flex items-center gap-3">
            {instance.autoSearchEnabled && (
              <span className="text-muted-foreground flex items-center gap-1">
                <RefreshCw className="size-3" />
                {instance.autoSearchLastRunAt
                  ? t("autoSearchLastRun", {
                      time: formatRelative(instance.autoSearchLastRunAt, tTime),
                    })
                  : t("autoSearchNeverRun")}
              </span>
            )}
            <Link
              href="/settings"
              className="text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <Settings className="size-3" /> {t("settings")}
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
