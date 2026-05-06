"use client";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { AppShell } from "@/client/components/layout/AppShell";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { KpiCard } from "@/client/components/dashboard/KpiCard";
import { InstanceSummaryCard } from "@/client/components/dashboard/InstanceSummaryCard";
import { RecentActivityList } from "@/client/components/dashboard/RecentActivityList";
import { NoInstancesPrompt } from "@/client/components/states/NoInstancesPrompt";
import { AllClearState } from "@/client/components/states/AllClearState";
import { PageErrorBoundary } from "@/client/components/states/PageErrorBoundary";
import { useInstances } from "@/client/hooks/data/useInstances";
import { useDashboardSummary } from "@/client/hooks/data/useDashboardSummary";
import { useConfig } from "@/client/hooks/data/useConfig";

export default function DashboardPage() {
  const router = useRouter();
  const t = useTranslations("dashboard");
  const tDryRun = useTranslations("settings.dryRun");
  const { data: instances, isLoading: loadingInstances } = useInstances();
  const { data: summary, isLoading: loadingSummary } = useDashboardSummary();
  const { data: config } = useConfig();

  if (!loadingInstances && (instances?.length ?? 0) === 0) {
    return (
      <AppShell>
        <NoInstancesPrompt onAdd={() => router.push("/settings")} />
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
              {config && (
                <Badge variant={config.dryRun ? "outline" : "destructive"}>
                  {config.dryRun ? tDryRun("badgeOn") : tDryRun("badgeOff")}
                </Badge>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push("/settings")}
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
            <KpiCard
              label={t("kpi.flaggedMovies")}
              value={flaggedMovies ?? "—"}
              href="/movies"
              tone={(flaggedMovies ?? 0) > 0 ? "warning" : "default"}
              loading={loadingSummary}
            />
            <KpiCard
              label={t("kpi.flaggedSeries")}
              value={flaggedSeries ?? "—"}
              href="/shows"
              tone={(flaggedSeries ?? 0) > 0 ? "warning" : "default"}
              loading={loadingSummary}
            />
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
              {(summary?.perInstance ?? []).map((inst) => (
                <InstanceSummaryCard key={inst.id} instance={inst} />
              ))}
            </div>
          </div>

          <RecentActivityList logs={summary?.recentActivity ?? []} />
        </div>
      </PageErrorBoundary>
    </AppShell>
  );
}
