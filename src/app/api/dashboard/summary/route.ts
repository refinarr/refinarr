import { NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { instanceRepository } from "@/server/repositories/InstanceRepository";
import { preferenceRepository } from "@/server/repositories/PreferenceRepository";
import { logRepository } from "@/server/repositories/LogRepository";
import { movieService } from "@/server/services/MovieService";
import { seriesService } from "@/server/services/SeriesService";
import type { DashboardSummary, DashboardInstanceSummary } from "@/shared/types/api";

export const GET = createApiHandler(async () => {
  const instances = await instanceRepository.findAll();

  const perInstance: DashboardInstanceSummary[] = await Promise.all(
    instances.map(async (inst) => {
      const [prefs, failed] = await Promise.all([
        preferenceRepository.findByInstance(inst.id),
        logRepository.findFailedByInstance(inst.id),
      ]);

      let flaggedCount = 0;
      if (inst.enabled) {
        try {
          if (inst.type === "radarr") {
            const result = await movieService.getFlaggedMovies(inst.id, {
              page: 1,
              limit: 1,
              sortBy: "score",
              order: "asc",
            });
            flaggedCount = result.total;
          } else {
            const result = await seriesService.getFlaggedSeries(inst.id, {
              page: 1,
              limit: 1,
              sortBy: "score",
              order: "asc",
            });
            flaggedCount = result.total;
          }
        } catch {
          flaggedCount = 0;
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
    })
  );

  const flaggedMovies = perInstance
    .filter((p) => p.type === "radarr")
    .reduce((sum, p) => sum + p.flaggedCount, 0);
  const flaggedSeries = perInstance
    .filter((p) => p.type === "sonarr")
    .reduce((sum, p) => sum + p.flaggedCount, 0);

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
