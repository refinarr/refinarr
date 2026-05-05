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

  // A type's total is null until every enabled instance of that type is
  // warm. Disabled instances drop out (no data to contribute). Zero enabled
  // instances → total is 0 (legit "nothing to flag"). This stops a cold
  // cache from rendering as "all clear" on the dashboard.
  const totalsByType: Record<ArrType, number> = { radarr: 0, sonarr: 0 };
  const enabledByType: Record<ArrType, number> = { radarr: 0, sonarr: 0 };
  const warmByType: Record<ArrType, number> = { radarr: 0, sonarr: 0 };
  for (const p of perInstance) {
    if (!p.enabled) continue;
    enabledByType[p.type] += 1;
    if (p.flaggedCount !== null) {
      warmByType[p.type] += 1;
      totalsByType[p.type] += p.flaggedCount;
    }
  }
  const totalFor = (t: ArrType): number | null =>
    enabledByType[t] === warmByType[t] ? totalsByType[t] : null;
  const flaggedMovies = totalFor("radarr");
  const flaggedSeries = totalFor("sonarr");

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
