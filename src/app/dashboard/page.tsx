"use client";
import { useRouter } from "next/navigation";
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
import { useInstances } from "@/client/hooks/useInstances";
import { useDashboardSummary } from "@/client/hooks/useDashboardSummary";
import { useConfig } from "@/client/hooks/useConfig";

export default function DashboardPage() {
  const router = useRouter();
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
  const totalFlagged = (totals?.flaggedMovies ?? 0) + (totals?.flaggedSeries ?? 0);
  const enabledInstances = (summary?.perInstance ?? []).filter((i) => i.enabled);

  return (
    <AppShell>
      <PageErrorBoundary>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Dashboard</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Overview of your instances and recent activity
              </p>
            </div>
            <div className="flex items-center gap-3">
              {config?.dryRun && <Badge variant="secondary">Dry Run</Badge>}
              <Button size="sm" variant="outline" onClick={() => router.push("/settings")}>
                <Plus className="h-4 w-4 mr-1" /> Add instance
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard
              label="Instances"
              value={summary?.perInstance.length ?? 0}
              loading={loadingSummary}
            />
            <KpiCard
              label="Flagged movies"
              value={totals?.flaggedMovies ?? 0}
              href="/movies"
              tone={(totals?.flaggedMovies ?? 0) > 0 ? "warning" : "default"}
              loading={loadingSummary}
            />
            <KpiCard
              label="Flagged series"
              value={totals?.flaggedSeries ?? 0}
              href="/shows"
              tone={(totals?.flaggedSeries ?? 0) > 0 ? "warning" : "default"}
              loading={loadingSummary}
            />
            <KpiCard
              label="Failed (24h)"
              value={totals?.failedActions24h ?? 0}
              href="/history?status=failed"
              tone={(totals?.failedActions24h ?? 0) > 0 ? "destructive" : "default"}
              loading={loadingSummary}
            />
          </div>

          {!loadingSummary && totalFlagged === 0 && enabledInstances.length > 0 && (
            <AllClearState />
          )}

          <div>
            <h2 className="text-lg font-semibold mb-3">Instances</h2>
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
