"use client";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { AppShell } from "@/client/components/layout/AppShell";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Skeleton } from "@/client/components/ui/skeleton";
import { KpiCard } from "@/client/components/dashboard/KpiCard";
import { InstanceSummaryCard } from "@/client/components/dashboard/InstanceSummaryCard";
import { RecentActivityList } from "@/client/components/dashboard/RecentActivityList";
import { NoInstancesPrompt } from "@/client/components/states/NoInstancesPrompt";
import { AllClearState } from "@/client/components/states/AllClearState";
import { PageErrorBoundary } from "@/client/components/states/PageErrorBoundary";
import { InstanceSummaryCardSkeleton } from "@/client/components/states/InstanceSummaryCardSkeleton";
import { RecentActivityListSkeleton } from "@/client/components/states/RecentActivityListSkeleton";
import { AutoSearchFleetSkeleton } from "@/client/components/states/AutoSearchFleetSkeleton";
import {
  useInstances,
  useConfiguredArrTypes,
} from "@/client/hooks/data/useInstances";
import { useDashboardSummary } from "@/client/hooks/data/useDashboardSummary";
import { useConfig } from "@/client/hooks/data/useConfig";
import { AutoSearchFleetPanel } from "@/app/dashboard/components/AutoSearchFleetPanel";

export default function DashboardPage() {
  const router = useRouter();
  const t = useTranslations("dashboard");
  const tDryRun = useTranslations("settings.dryRun");
  const { data: instances, isLoading: loadingInstances } = useInstances();
  const {
    data: summary,
    isLoading: loadingSummary,
    isError: summaryError,
  } = useDashboardSummary();
  const { data: config } = useConfig();
  const arrTypes = useConfiguredArrTypes();

  if (!loadingInstances && (instances?.length ?? 0) === 0) {
    return (
      <AppShell>
        <NoInstancesPrompt onAdd={() => router.push("/settings/instances")} />
      </AppShell>
    );
  }

  const totals = summary?.totals;
  const flaggedMovies = totals?.flaggedMovies ?? null;
  const flaggedSeries = totals?.flaggedSeries ?? null;
  // Both totals must be known before we can claim "all clear" — a null on
  // either side means at least one instance of that type is still cold and
  // its real count could be non-zero.
  const totalsKnown = flaggedMovies !== null && flaggedSeries !== null;
  const totalFlagged = (flaggedMovies ?? 0) + (flaggedSeries ?? 0);
  const enabledInstances = (summary?.perInstance ?? []).filter(
    (i) => i.enabled,
  );
  // Instance list is cached app-wide (sidebar), so it's almost always known
  // while the summary is still loading — drives the skeleton counts below so
  // the reserved height matches the real cards/rows and the dashboard doesn't
  // shift when the summary resolves.
  const autoSearchCount = (instances ?? []).filter(
    (i) => i.autoSearchEnabled,
  ).length;
  // On a cold load the instance list is still undefined at first paint, so
  // fall back to 2 (the canonical radarr+sonarr setup) — rendering zero
  // skeleton cards is what let the grid grow ~2 cards' height when the
  // summary resolved and shoved the activity list down (~289px shift).
  const instanceSkeletonCount = instances?.length ?? 2;

  return (
    <AppShell>
      <PageErrorBoundary>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{t("title")}</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                {t("subtitle")}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {config ? (
                <Badge
                  size="md"
                  variant={config.dryRun ? "outline" : "destructive"}
                >
                  {config.dryRun ? tDryRun("badgeOn") : tDryRun("badgeOff")}
                </Badge>
              ) : (
                // Reserve the badge's footprint so it doesn't pop in when
                // useConfig() resolves and shove the button left (top-of-page
                // shift = highest CLS impact). Matches the md badge height.
                <Skeleton className="h-control-xs w-24 rounded-4xl" />
              )}
              <Button
                variant="outline"
                onClick={() => router.push("/settings/instances")}
              >
                <Plus className="mr-1 size-4" /> {t("addInstance")}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard
              label={t("kpi.instances")}
              value={summary?.perInstance.length ?? 0}
              loading={loadingSummary}
            />
            {arrTypes.includes("radarr") && (
              <KpiCard
                label={t("kpi.flaggedMovies")}
                value={flaggedMovies ?? "—"}
                href="/movies"
                tone={(flaggedMovies ?? 0) > 0 ? "warning" : "default"}
                loading={loadingSummary}
                valueLoading={
                  !loadingSummary && !summaryError && flaggedMovies === null
                }
              />
            )}
            {arrTypes.includes("sonarr") && (
              <KpiCard
                label={t("kpi.flaggedSeries")}
                value={flaggedSeries ?? "—"}
                href="/shows"
                tone={(flaggedSeries ?? 0) > 0 ? "warning" : "default"}
                loading={loadingSummary}
                valueLoading={
                  !loadingSummary && !summaryError && flaggedSeries === null
                }
              />
            )}
            <KpiCard
              label={t("kpi.failed24h")}
              value={totals?.failedActions24h ?? 0}
              href="/history?status=failed"
              tone={
                (totals?.failedActions24h ?? 0) > 0 ? "destructive" : "default"
              }
              loading={loadingSummary}
            />
          </div>

          {!loadingSummary &&
            totalsKnown &&
            totalFlagged === 0 &&
            enabledInstances.length > 0 && <AllClearState />}

          <div>
            <h2 className="mb-3 text-lg font-semibold">{t("instances")}</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {loadingSummary
                ? Array.from({ length: instanceSkeletonCount }).map((_, i) => (
                    <InstanceSummaryCardSkeleton key={i} />
                  ))
                : (summary?.perInstance ?? []).map((inst) => (
                    <InstanceSummaryCard key={inst.id} instance={inst} />
                  ))}
            </div>
          </div>

          {loadingSummary ? (
            autoSearchCount > 0 && (
              <AutoSearchFleetSkeleton rows={autoSearchCount} />
            )
          ) : (
            <AutoSearchFleetPanel instances={summary?.perInstance ?? []} />
          )}

          {loadingSummary ? (
            <RecentActivityListSkeleton />
          ) : (
            <RecentActivityList logs={summary?.recentActivity ?? []} />
          )}
        </div>
      </PageErrorBoundary>
    </AppShell>
  );
}
