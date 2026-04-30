import type { FlaggedSeries, ActionLog } from "@/shared/types/models";
import { MediaService } from "./MediaService";
import { instanceRepository } from "@/server/repositories/InstanceRepository";
import { preferenceRepository } from "@/server/repositories/PreferenceRepository";
import { ignoreRepository } from "@/server/repositories/IgnoreRepository";
import { configRepository } from "@/server/repositories/ConfigRepository";
import { ArrClientFactory } from "@/server/clients/ArrClientFactory";
import { SonarrClient } from "@/server/clients/SonarrClient";
import {
  isMissingWantedFormats,
  getMissingFormats,
  scoreCfCoverage,
  isBelowProfileScore,
  scoreProfileCoverage,
} from "@/server/lib/scoring";

interface SeriesQuery {
  page: number;
  limit: number;
  sortBy: "score" | "title" | "added";
  order: "asc" | "desc";
  maxScore?: number;
}

export class SeriesService extends MediaService {
  async getFlaggedSeries(
    instanceId: number,
    query: SeriesQuery
  ): Promise<{ items: FlaggedSeries[]; total: number }> {
    const instance = await instanceRepository.findById(instanceId);
    if (!instance) throw new Error(`Instance ${instanceId} not found`);

    const client = ArrClientFactory.createArrClient(instance) as SonarrClient;
    const [series, scoringMode] = await Promise.all([
      client.getSeries(),
      configRepository.get(`scoringMode:${instanceId}`),
    ]);

    const mode = scoringMode ?? "manual";
    const ignoredSet = new Set(
      (await ignoreRepository.findByInstance(instanceId))
        .filter((e) => e.mediaType === "series")
        .map((e) => e.mediaId)
    );

    let flagged: FlaggedSeries[];

    if (mode === "profile") {
      const profiles = await client.getQualityProfiles();
      const profileMap = new Map(profiles.map((p) => [p.id, p]));
      flagged = series
        .filter((s) => !ignoredSet.has(s.id))
        .filter((s) => {
          const profile = profileMap.get(s.qualityProfileId);
          if (!profile) return false;
          return isBelowProfileScore(s.customFormatScore, profile.minUpgradeFormatScore);
        })
        .map((s) => {
          const profile = profileMap.get(s.qualityProfileId)!;
          return {
            id: s.id,
            title: s.title,
            year: s.year,
            qualityProfileId: s.qualityProfileId,
            customFormats: s.customFormats,
            customFormatScore: s.customFormatScore,
            cfScore: scoreProfileCoverage(s.customFormatScore, profile.minUpgradeFormatScore),
            missingFormats: [],
            scoreDelta: profile.minUpgradeFormatScore - s.customFormatScore,
          };
        });
    } else {
      const prefs = await preferenceRepository.findByInstance(instanceId);
      if (prefs.length === 0) return { items: [], total: 0 };

      const wantedIds = prefs.map((p) => p.cfId);
      const wantedCfs = prefs.map((p) => ({ id: p.cfId, name: p.cfName }));

      flagged = series
        .filter((s) => !ignoredSet.has(s.id))
        .filter((s) => isMissingWantedFormats(s.customFormats, wantedIds))
        .map((s) => ({
          id: s.id,
          title: s.title,
          year: s.year,
          qualityProfileId: s.qualityProfileId,
          customFormats: s.customFormats,
          customFormatScore: s.customFormatScore,
          cfScore: scoreCfCoverage(s.customFormats, wantedIds),
          missingFormats: getMissingFormats(s.customFormats, wantedCfs),
        }));
    }

    if (query.maxScore !== undefined) {
      flagged = flagged.filter((s) => s.cfScore <= query.maxScore!);
    }

    flagged.sort((a, b) => {
      const dir = query.order === "asc" ? 1 : -1;
      if (query.sortBy === "score") return (a.cfScore - b.cfScore) * dir;
      if (query.sortBy === "title") return a.title.localeCompare(b.title) * dir;
      return 0;
    });

    const total = flagged.length;
    const start = (query.page - 1) * query.limit;
    return { items: flagged.slice(start, start + query.limit), total };
  }

  async triggerSearch(instanceId: number, mediaId: number, title: string): Promise<ActionLog> {
    const instance = await instanceRepository.findById(instanceId);
    if (!instance) throw new Error(`Instance ${instanceId} not found`);
    const client = ArrClientFactory.createArrClient(instance) as SonarrClient;

    return this.executeAction({
      instanceId,
      action: "search",
      mediaId,
      title,
      payload: { instanceId, action: "search", mediaId, title, type: "sonarr" },
      run: () => client.triggerSearch(mediaId),
    });
  }
}

export const seriesService = new SeriesService();
