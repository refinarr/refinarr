import type { FlaggedSeries, EpisodeFileEntry, ActionLog, MediaQuery, ScoringMode } from "@/shared/types/models";
import { isProfileMode } from "@/shared/scoring-mode";
import { MediaService } from "./MediaService";
import { instanceRepository } from "@/server/repositories/InstanceRepository";
import { preferenceRepository } from "@/server/repositories/PreferenceRepository";
import { ignoreRepository } from "@/server/repositories/IgnoreRepository";
import { ArrClientFactory } from "@/server/clients/ArrClientFactory";
import { SonarrClient } from "@/server/clients/SonarrClient";
import { dataCache, CACHE_TTL_MS } from "@/server/lib/DataCache";
import { appLogger } from "@/server/lib/app-logger";
import { LogSource } from "@/server/lib/log-sources";
import {
  isMissingWantedFormats,
  getMissingFormats,
  scoreCfCoverage,
  isBelowProfileScore,
  scoreProfileCoverage,
} from "@/shared/scoring";
import type { RetryActionOptions } from "./media-services";


export class SeriesService extends MediaService {
  async getFlaggedSeries(
    instanceId: number,
    query: MediaQuery
  ): Promise<{ items: FlaggedSeries[]; total: number }> {
    const instance = await instanceRepository.findById(instanceId);
    if (!instance) throw new Error(`Instance ${instanceId} not found`);

    const mode = instance.scoringMode;
    const cacheKey = `series:${instanceId}:${mode}`;
    let cached = dataCache.get<{ flagged: FlaggedSeries[] }>(cacheKey, CACHE_TTL_MS);

    if (cached) {
      appLogger.debug("Cache hit", { source: LogSource.SeriesService, context: { cacheKey } });
    } else {
      const startedAt = Date.now();
      const flagged = await this.buildFlaggedSeries(instanceId, instance, mode);
      cached = { flagged };
      dataCache.set(cacheKey, cached);
      appLogger.debug("Built flagged series cache", {
        source: LogSource.SeriesService,
        context: {
          instanceId,
          instanceName: instance.name,
          mode,
          flagged: flagged.length,
          durationMs: Date.now() - startedAt,
        },
      });
    }

    return this.applyQuery(cached.flagged, query, mode, (s) => s.episodeFiles.length > 0);
  }

  private async buildFlaggedSeries(
    instanceId: number,
    instance: Awaited<ReturnType<typeof instanceRepository.findById>>,
    mode: ScoringMode
  ): Promise<FlaggedSeries[]> {
    const client = ArrClientFactory.createArrClient(instance!) as SonarrClient;
    const [series, profiles] = await Promise.all([
      client.getSeries(),
      client.getQualityProfiles(),
    ]);

    const profileMap = new Map(profiles.map((p) => [p.id, p]));
    const profileScoreMap = new Map<number, Map<number, number>>();
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

    const ignoredSet = new Set(
      (await ignoreRepository.findByInstance(instanceId))
        .filter((e) => e.mediaType === "series")
        .map((e) => e.mediaId)
    );

    const seriesIds = series.filter((s) => !ignoredSet.has(s.id)).map((s) => s.id);
    const episodeFilesMap = await client.getAllEpisodeFiles(seriesIds);

    if (isProfileMode(mode)) {
      return series
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
    }

    const prefs = await preferenceRepository.findByInstance(instanceId);
    if (prefs.length === 0) return [];

    const wantedIds = prefs.map((p) => p.cfId);
    const wantedCfs = prefs.map((p) => ({ id: p.cfId, name: p.cfName }));

    return series
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


  // Returns the flagged-count from cache if warm, or null if cold. Used by
  // the dashboard summary route to avoid triggering a multi-second upstream
  // build inline. Caller is responsible for kicking off a background warm
  // when null is returned.
  getCachedFlaggedTotal(instanceId: number, mode: ScoringMode): number | null {
    const cached = dataCache.get<{ flagged: FlaggedSeries[] }>(
      `series:${instanceId}:${mode}`,
      CACHE_TTL_MS,
    );
    return cached?.flagged.length ?? null;
  }

  // Uniform name across MovieService / SeriesService for use via
  // mediaServiceFor(arrType). Warms the flagged-media cache by issuing a
  // minimal getFlaggedSeries call.
  warmFlaggedCache(instanceId: number): Promise<unknown> {
    return this.getFlaggedSeries(instanceId, { page: 1, limit: 1, sortBy: "score", order: "asc" });
  }

  // Re-runs a stored ActionLog payload. Series-specific fields:
  //   - search: { instanceId, mediaId, title }
  //   - delete: { instanceId, mediaId, fileIds, title, triggerSearch? }
  async retryFromPayload(payload: Record<string, unknown>, opts: RetryActionOptions = {}): Promise<ActionLog> {
    const action = payload.action as string;
    const instanceId = payload.instanceId as number;
    const mediaId = payload.mediaId as number;
    const title = payload.title as string;
    if (action === "search") {
      return this.triggerSearch(instanceId, mediaId, title, opts);
    }
    if (action === "delete" || action === "delete_blacklist") {
      return this.deleteFiles(
        instanceId,
        mediaId,
        payload.fileIds as number[],
        title,
        !!payload.triggerSearch,
        opts,
      );
    }
    throw new Error(`Cannot retry action type: ${action}`);
  }

  async deleteFiles(
    instanceId: number,
    mediaId: number,
    fileIds: number[],
    title: string,
    triggerSearch = false,
    opts: RetryActionOptions = {}
  ): Promise<ActionLog> {
    const instance = await instanceRepository.findById(instanceId);
    if (!instance) throw new Error(`Instance ${instanceId} not found`);
    const client = ArrClientFactory.createArrClient(instance) as SonarrClient;

    return this.executeAction({
      instanceName: instance.name,
      instanceId,
      action: "delete",
      mediaId,
      title,
      actionLogId: opts.actionLogId,
      payload: { instanceId, action: "delete", mediaId, fileIds, title, triggerSearch },
      run: async () => {
        for (const fileId of fileIds) {
          await client.deleteEpisodeFile(fileId);
        }
        if (triggerSearch) await client.triggerSearch(mediaId);
      },
    });
  }

  async triggerSearch(
    instanceId: number,
    mediaId: number,
    title: string,
    opts: RetryActionOptions = {}
  ): Promise<ActionLog> {
    const instance = await instanceRepository.findById(instanceId);
    if (!instance) throw new Error(`Instance ${instanceId} not found`);
    const client = ArrClientFactory.createArrClient(instance) as SonarrClient;

    return this.executeAction({
      instanceName: instance.name,
      instanceId,
      action: "search",
      mediaId,
      title,
      actionLogId: opts.actionLogId,
      payload: { instanceId, action: "search", mediaId, title },
      run: () => client.triggerSearch(mediaId),
    });
  }

  async triggerSeasonSearch(
    instanceId: number,
    mediaId: number,
    seasonNumber: number,
    title: string,
    opts: RetryActionOptions = {}
  ): Promise<ActionLog> {
    const instance = await instanceRepository.findById(instanceId);
    if (!instance) throw new Error(`Instance ${instanceId} not found`);
    const client = ArrClientFactory.createArrClient(instance) as SonarrClient;

    return this.executeAction({
      instanceName: instance.name,
      instanceId,
      action: "search",
      mediaId,
      title,
      actionLogId: opts.actionLogId,
      payload: { instanceId, action: "search", mediaId, seasonNumber, title },
      run: () => client.triggerSeasonSearch(mediaId, seasonNumber),
    });
  }

  async triggerEpisodeFileSearch(
    instanceId: number,
    mediaId: number,
    fileId: number,
    title: string,
    opts: RetryActionOptions = {}
  ): Promise<ActionLog> {
    const instance = await instanceRepository.findById(instanceId);
    if (!instance) throw new Error(`Instance ${instanceId} not found`);
    const client = ArrClientFactory.createArrClient(instance) as SonarrClient;

    return this.executeAction({
      instanceName: instance.name,
      instanceId,
      action: "search",
      mediaId,
      title,
      actionLogId: opts.actionLogId,
      payload: { instanceId, action: "search", mediaId, fileId, title },
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
