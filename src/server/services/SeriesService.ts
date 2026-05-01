import type { FlaggedSeries, EpisodeFileEntry, ActionLog } from "@/shared/types/models";
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
    const [series, profiles, scoringMode] = await Promise.all([
      client.getSeries(),
      client.getQualityProfiles(),
      configRepository.get(`scoringMode:${instanceId}`),
    ]);

    const profileMap = new Map(profiles.map((p) => [p.id, p]));
    // profileId -> cfId -> score (from quality profile's formatItems)
    const profileScoreMap = new Map<number, Map<number, number>>();
    for (const p of profiles) {
      const cfMap = new Map<number, number>();
      for (const item of p.formatItems) cfMap.set(item.format, item.score);
      profileScoreMap.set(p.id, cfMap);
    }

    const mode = scoringMode ?? "manual";
    const ignoredSet = new Set(
      (await ignoreRepository.findByInstance(instanceId))
        .filter((e) => e.mediaType === "series")
        .map((e) => e.mediaId)
    );

    const seriesIds = series.filter((s) => !ignoredSet.has(s.id)).map((s) => s.id);
    const episodeFilesMap = await client.getAllEpisodeFiles(seriesIds);

    let flagged: FlaggedSeries[];

    if (mode === "profile") {
      flagged = series
        .filter((s) => !ignoredSet.has(s.id))
        .filter((s) => {
          const profile = profileMap.get(s.qualityProfileId);
          if (!profile) return false;
          const files = episodeFilesMap.get(s.id) ?? [];
          if (files.length === 0) return false;
          return files.some((f) => isBelowProfileScore(f.customFormatScore ?? 0, profile.cutoffFormatScore));
        })
        .map((s) => {
          const profile = profileMap.get(s.qualityProfileId)!;
          const files = episodeFilesMap.get(s.id) ?? [];
          const worstScore = files.length
            ? Math.min(...files.map((f) => f.customFormatScore ?? 0))
            : 0;
          const affectedEpisodeCount = files.filter(
            (f) => isBelowProfileScore(f.customFormatScore ?? 0, profile.cutoffFormatScore)
          ).length;
          const cfScores = profileScoreMap.get(s.qualityProfileId) ?? new Map<number, number>();
          const episodeFiles: EpisodeFileEntry[] = files.map((f) => ({
            id: f.id,
            seasonNumber: f.seasonNumber,
            relativePath: f.relativePath,
            customFormats: f.customFormats?.map(cf => ({ id: cf.id, name: cf.name, score: cfScores.get(cf.id) })) ?? [],
            customFormatScore: f.customFormatScore ?? 0,
            missingFormats: [],
            minProfileScore: profile.cutoffFormatScore,
          }));
          return {
            id: s.id,
            title: s.title,
            year: s.year,
            qualityProfileId: s.qualityProfileId,
            customFormats: [],
            customFormatScore: worstScore,
            cfScore: scoreProfileCoverage(worstScore, profile.cutoffFormatScore),
            missingFormats: [],
            minProfileScore: profile.cutoffFormatScore,
            affectedEpisodeCount,
            totalEpisodeCount: files.length,
            episodeFiles,
          };
        });
    } else {
      const prefs = await preferenceRepository.findByInstance(instanceId);
      if (prefs.length === 0) return { items: [], total: 0 };

      const wantedIds = prefs.map((p) => p.cfId);
      const wantedCfs = prefs.map((p) => ({ id: p.cfId, name: p.cfName }));

      flagged = series
        .filter((s) => !ignoredSet.has(s.id))
        .filter((s) => {
          const files = episodeFilesMap.get(s.id) ?? [];
          if (files.length === 0) return true;
          return files.some((f) => isMissingWantedFormats(f.customFormats ?? [], wantedIds));
        })
        .map((s) => {
          const files = episodeFilesMap.get(s.id) ?? [];
          const allMissingIds = new Set<number>();
          let affectedEpisodeCount = 0;
          for (const f of files) {
            const missing = getMissingFormats(f.customFormats ?? [], wantedCfs);
            if (missing.length > 0) {
              affectedEpisodeCount++;
              missing.forEach((cf) => allMissingIds.add(cf.id));
            }
          }
          const missingFormats = wantedCfs.filter((cf) => allMissingIds.has(cf.id));
          const worstCoverage = files.length === 0
            ? 0
            : Math.min(...files.map((f) => scoreCfCoverage(f.customFormats ?? [], wantedIds)));
          const cfScores = profileScoreMap.get(s.qualityProfileId) ?? new Map<number, number>();
          const episodeFiles: EpisodeFileEntry[] = files.map((f) => ({
            id: f.id,
            seasonNumber: f.seasonNumber,
            relativePath: f.relativePath,
            customFormats: f.customFormats?.map(cf => ({ id: cf.id, name: cf.name, score: cfScores.get(cf.id) })) ?? [],
            customFormatScore: f.customFormatScore ?? 0,
            missingFormats: getMissingFormats(f.customFormats ?? [], wantedCfs),
          }));
          return {
            id: s.id,
            title: s.title,
            year: s.year,
            qualityProfileId: s.qualityProfileId,
            customFormats: [],
            customFormatScore: 0,
            cfScore: worstCoverage,
            missingFormats,
            affectedEpisodeCount,
            totalEpisodeCount: files.length,
            episodeFiles,
          };
        });
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
