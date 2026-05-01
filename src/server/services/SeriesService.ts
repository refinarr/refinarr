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
  sortBy: "score" | "title" | "added" | "size";
  order: "asc" | "desc";
  maxScore?: number;
  q?: string;
  profileId?: number;
  missingCfId?: number;
  hasNegativeCfId?: number;
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
    // profileId -> positive-score CFs (for missingFormats in profile mode)
    const profileFormatMap = new Map<number, Array<{ id: number; name: string }>>();
    for (const p of profiles) {
      const cfMap = new Map<number, number>();
      for (const item of p.formatItems) cfMap.set(item.format, item.score);
      profileScoreMap.set(p.id, cfMap);
      profileFormatMap.set(
        p.id,
        p.formatItems.filter((item) => item.score > 0).map((item) => ({ id: item.format, name: item.name }))
      );
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
          if (files.length === 0) return profile.cutoffFormatScore > 0;
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
          const positiveProfileCfs = profileFormatMap.get(s.qualityProfileId) ?? [];
          const episodeFiles: EpisodeFileEntry[] = files.map((f) => {
            const fileCfs = f.customFormats ?? [];
            const fileCfIds = new Set(fileCfs.map((cf) => cf.id));
            const unwantedFormats = fileCfs
              .filter((cf) => (cfScores.get(cf.id) ?? 0) < 0)
              .map((cf) => ({ id: cf.id, name: cf.name, score: cfScores.get(cf.id) }));
            return {
              id: f.id,
              seasonNumber: f.seasonNumber,
              relativePath: f.relativePath,
              customFormats: fileCfs.map((cf) => ({ id: cf.id, name: cf.name, score: cfScores.get(cf.id) })),
              customFormatScore: f.customFormatScore ?? 0,
              missingFormats: positiveProfileCfs.filter((cf) => !fileCfIds.has(cf.id)),
              unwantedFormats,
              minProfileScore: profile.cutoffFormatScore,
              size: f.size ?? 0,
            };
          });
          const missingCfIds = new Set<number>();
          const unwantedCfIds = new Map<number, { id: number; name: string; score?: number }>();
          for (const ef of episodeFiles) {
            if (isBelowProfileScore(ef.customFormatScore, profile.cutoffFormatScore)) {
              ef.missingFormats.forEach((cf) => missingCfIds.add(cf.id));
            }
            ef.unwantedFormats.forEach((cf) => unwantedCfIds.set(cf.id, cf));
          }
          const missingFormats = files.length === 0
            ? positiveProfileCfs
            : positiveProfileCfs.filter((cf) => missingCfIds.has(cf.id));
          return {
            id: s.id,
            title: s.title,
            year: s.year,
            qualityProfileId: s.qualityProfileId,
            customFormats: [],
            customFormatScore: worstScore,
            cfScore: scoreProfileCoverage(worstScore, profile.cutoffFormatScore),
            missingFormats,
            unwantedFormats: Array.from(unwantedCfIds.values()),
            minProfileScore: profile.cutoffFormatScore,
            affectedEpisodeCount,
            totalEpisodeCount: files.length,
            episodeFiles,
            sizeOnDisk: files.reduce((acc, f) => acc + (f.size ?? 0), 0),
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
            unwantedFormats: [],
            size: f.size ?? 0,
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
            unwantedFormats: [],
            affectedEpisodeCount,
            totalEpisodeCount: files.length,
            episodeFiles,
            sizeOnDisk: files.reduce((acc, f) => acc + (f.size ?? 0), 0),
          };
        });
    }

    if (query.maxScore !== undefined) {
      flagged = flagged.filter((s) => s.cfScore <= query.maxScore!);
    }

    if (query.q) {
      const q = query.q.toLowerCase();
      flagged = flagged.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.missingFormats.some((cf) => cf.name.toLowerCase().includes(q))
      );
    }

    if (query.profileId !== undefined) {
      flagged = flagged.filter((s) => s.qualityProfileId === query.profileId);
    }

    if (query.missingCfId !== undefined) {
      flagged = flagged.filter((s) => s.missingFormats.some((cf) => cf.id === query.missingCfId));
    }

    if (query.hasNegativeCfId !== undefined) {
      flagged = flagged.filter((s) => s.unwantedFormats.some((cf) => cf.id === query.hasNegativeCfId));
    }

    flagged.sort((a, b) => {
      const dir = query.order === "asc" ? 1 : -1;
      if (query.sortBy === "score" || query.sortBy === "size") {
        const aFileless = a.episodeFiles.length === 0;
        const bFileless = b.episodeFiles.length === 0;
        if (aFileless && bFileless) return 0;
        if (aFileless) return 1;
        if (bFileless) return -1;
      }
      if (query.sortBy === "score") {
        const aScore = mode === "profile" ? a.customFormatScore : a.cfScore;
        const bScore = mode === "profile" ? b.customFormatScore : b.cfScore;
        return (aScore - bScore) * dir;
      }
      if (query.sortBy === "title") return a.title.localeCompare(b.title) * dir;
      if (query.sortBy === "size") return (a.sizeOnDisk - b.sizeOnDisk) * dir;
      return 0;
    });

    const total = flagged.length;
    const start = (query.page - 1) * query.limit;
    return { items: flagged.slice(start, start + query.limit), total };
  }

  async deleteFiles(
    instanceId: number,
    mediaId: number,
    fileIds: number[],
    title: string,
    triggerSearch = false
  ): Promise<ActionLog> {
    const instance = await instanceRepository.findById(instanceId);
    if (!instance) throw new Error(`Instance ${instanceId} not found`);
    const client = ArrClientFactory.createArrClient(instance) as SonarrClient;

    return this.executeAction({
      instanceId,
      action: "delete",
      mediaId,
      title,
      payload: { instanceId, action: "delete", mediaId, fileIds, title, triggerSearch, type: "sonarr" },
      run: async () => {
        for (const fileId of fileIds) {
          await client.deleteEpisodeFile(fileId);
        }
        if (triggerSearch) await client.triggerSearch(mediaId);
      },
    });
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

  async triggerSeasonSearch(
    instanceId: number,
    mediaId: number,
    seasonNumber: number,
    title: string
  ): Promise<ActionLog> {
    const instance = await instanceRepository.findById(instanceId);
    if (!instance) throw new Error(`Instance ${instanceId} not found`);
    const client = ArrClientFactory.createArrClient(instance) as SonarrClient;

    return this.executeAction({
      instanceId,
      action: "search",
      mediaId,
      title,
      payload: { instanceId, action: "search", mediaId, seasonNumber, title, type: "sonarr" },
      run: () => client.triggerSeasonSearch(mediaId, seasonNumber),
    });
  }

  async triggerEpisodeFileSearch(
    instanceId: number,
    mediaId: number,
    fileId: number,
    title: string
  ): Promise<ActionLog> {
    const instance = await instanceRepository.findById(instanceId);
    if (!instance) throw new Error(`Instance ${instanceId} not found`);
    const client = ArrClientFactory.createArrClient(instance) as SonarrClient;

    return this.executeAction({
      instanceId,
      action: "search",
      mediaId,
      title,
      payload: { instanceId, action: "search", mediaId, fileId, title, type: "sonarr" },
      run: async () => {
        const episodes = await client.getEpisodes(mediaId);
        const episodeIds = episodes.filter((e) => e.episodeFileId === fileId).map((e) => e.id);
        if (episodeIds.length === 0) throw new Error("Episode not found for file");
        await client.triggerEpisodeSearch(episodeIds);
      },
    });
  }
}

export const seriesService = new SeriesService();
