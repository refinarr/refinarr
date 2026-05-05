import { NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { instanceRepository } from "@/server/repositories/InstanceRepository";
import { preferenceRepository } from "@/server/repositories/PreferenceRepository";
import { logRepository } from "@/server/repositories/LogRepository";
import { mediaServiceFor } from "@/server/services/media-services";
import type { DashboardSummary, DashboardInstanceSummary } from "@/shared/types/api";
import type { ArrType } from "@/shared/types/models";

// The summary endpoint reads flagged-counts from cache only. A cold cache
// returns null (UI shows "—") and triggers a background build so the next
// dashboard refetch shows the real count. This avoids blocking the
// dashboard load on multi-second upstream Radarr/Sonarr API fetches.

export const GET = createApiHandler(async () => {
  const instances = await instanceRepository.findAll();

  const perInstance: DashboardInstanceSummary[] = await Promise.all(
    instances.map(async (inst) => {
      const [prefs, failed] = await Promise.all([
        preferenceRepository.findByInstance(inst.id),
        logRepository.findFailedByInstance(inst.id),
      ]);

      let flaggedCount: number | null = null;
      if (inst.enabled) {
        const svc = mediaServiceFor(inst.type);
        flaggedCount = svc.getCachedFlaggedTotal(inst.id, inst.scoringMode);

        // Cold cache: kick off a background build so the next dashboard
        // refetch picks up the real count. Errors are swallowed (the
        // service already logs them); this isn't on the request path.
        if (flaggedCount === null) {
          svc.warmFlaggedCache(inst.id).catch(() => {});
        }
      }

      return {
        id: inst.id,
        type: inst.type,
        name: inst.name,
        enabled: inst.enabled,
        flaggedCount,
        failedActionsCount: failed.length,
        hasPreferences: prefs.length > 0,
      };
    }),
  );

  // Totals only sum non-null counts. Cold instances drop out — better than
  // showing 0 (which implies "all clear") or blocking on a build.
  const totalsByType: Record<ArrType, number> = { radarr: 0, sonarr: 0 };
  for (const p of perInstance) {
    if (p.flaggedCount !== null) totalsByType[p.type] += p.flaggedCount;
  }
  const flaggedMovies = totalsByType.radarr;
  const flaggedSeries = totalsByType.sonarr;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [failedActions24h, recentActivity] = await Promise.all([
    logRepository.countByStatusSince("failed", since),
    logRepository.findRecent(10),
  ]);

  const summary: DashboardSummary = {
    perInstance,
    totals: { flaggedMovies, flaggedSeries, failedActions24h },
    recentActivity,
  };

  return NextResponse.json(summary);
});
