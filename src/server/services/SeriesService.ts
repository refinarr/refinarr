import { instanceRepository } from "@/server/repositories/InstanceRepository";
import { preferenceRepository } from "@/server/repositories/PreferenceRepository";
import { ignoreRepository } from "@/server/repositories/IgnoreRepository";
import { ArrClientFactory } from "@/server/clients/ArrClientFactory";
import { SonarrClient } from "@/server/clients/SonarrClient";
import { appLogger } from "@/server/lib/app-logger";
import { LogSource } from "@/server/lib/log-sources";
import { badRequest } from "@/server/lib/api-errors";
import {
  isMissingWantedFormats,
  getMissingFormats,
  scoreCfCoverage,
  isBelowProfileScore,
  scoreProfileCoverage,
} from "@/shared/scoring";
import { isProfileMode } from "@/shared/scoring-mode";
import { seriesRetryPayloadSchema } from "@/shared/types/schemas";
import type {
  FlaggedSeries,
  EpisodeFileEntry,
  ActionLog,
  MediaQuery,
  ScoringMode,
} from "@/shared/types/models";
import { MediaService } from "./MediaService";
import type { RetryActionOptions } from "./media-services";

export class SeriesService extends MediaService<FlaggedSeries> {
  protected readonly cacheNamespace = "series";

  protected getFlaggedForWarm(
    instanceId: number,
    query: MediaQuery,
  ): Promise<{ items: FlaggedSeries[]; total: number }> {
    return this.getFlaggedSeries(instanceId, query);
  }

  async getFlaggedSeries(
    instanceId: number,
    query: MediaQuery,
  ): Promise<{ items: FlaggedSeries[]; total: number }> {
    const instance = await instanceRepository.findById(instanceId);
    if (!instance) throw new Error(`Instance ${instanceId} not found`);

    const mode = instance.scoringMode;
    const cacheKey = this.flaggedCacheKey(instanceId, mode);
    const cached = await this.readWithSwr<{ flagged: FlaggedSeries[] }>({
      cacheKey,
      instanceId: instance.id,
      logSource: LogSource.SeriesService,
      backgroundErrorMessage: "Background flagged-series rebuild failed",
      build: () => this.buildFlaggedAndLog(instance.id, instance, mode),
    });
    return this.applyQuery(
      cached.flagged,
      query,
      mode,
      (s) => s.episodeFiles.length > 0,
    );
  }

  private async buildFlaggedAndLog(
    instanceId: number,
    instance: NonNullable<
      Awaited<ReturnType<typeof instanceRepository.findById>>
    >,
    mode: ScoringMode,
  ): Promise<{ flagged: FlaggedSeries[] }> {
    const startedAt = Date.now();
    const flagged = await this.buildFlaggedSeries(instanceId, instance, mode);
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
    return { flagged };
  }

  private async buildFlaggedSeries(
    instanceId: number,
    instance: Awaited<ReturnType<typeof instanceRepository.findById>>,
    mode: ScoringMode,
  ): Promise<FlaggedSeries[]> {
    const client = ArrClientFactory.createArrClient(instance!) as SonarrClient;
    const [series, profiles] = await Promise.all([
      client.getSeries(),
      client.getQualityProfiles(),
    ]);

    const profileMap = new Map(profiles.map((p) => [p.id, p]));
    const profileScoreMap = new Map<number, Map<number, number>>();
    const profileFormatMap = new Map<
      number,
      Array<{ id: number; name: string }>
    >();
    for (const p of profiles) {
      const cfMap = new Map<number, number>();
      for (const item of p.formatItems) cfMap.set(item.format, item.score);
      profileScoreMap.set(p.id, cfMap);
      profileFormatMap.set(
        p.id,
        p.formatItems
          .filter((item) => item.score > 0)
          .map((item) => ({ id: item.format, name: item.name })),
      );
    }

    const ignoredSet = new Set(
      (await ignoreRepository.findByInstance(instanceId))
        .filter((e) => e.mediaType === "series")
        .map((e) => e.mediaId),
    );

    const seriesIds = series
      .filter((s) => !ignoredSet.has(s.id))
      .map((s) => s.id);
    const episodeFilesMap = await client.getAllEpisodeFiles(seriesIds);

    if (isProfileMode(mode)) {
      return series
        .filter((s) => !ignoredSet.has(s.id))
        .filter((s) => {
          const profile = profileMap.get(s.qualityProfileId);
          if (!profile) return false;
          const files = episodeFilesMap.get(s.id) ?? [];
          if (files.length === 0) return profile.cutoffFormatScore > 0;
          return files.some((f) =>
            isBelowProfileScore(
              f.customFormatScore ?? 0,
              profile.cutoffFormatScore,
            ),
          );
        })
        .map((s) => {
          const profile = profileMap.get(s.qualityProfileId)!;
          const files = episodeFilesMap.get(s.id) ?? [];
          const worstScore = files.length
            ? Math.min(...files.map((f) => f.customFormatScore ?? 0))
            : 0;
          const affectedEpisodeCount = files.filter((f) =>
            isBelowProfileScore(
              f.customFormatScore ?? 0,
              profile.cutoffFormatScore,
            ),
          ).length;
          const cfScores =
            profileScoreMap.get(s.qualityProfileId) ??
            new Map<number, number>();
          const positiveProfileCfs =
            profileFormatMap.get(s.qualityProfileId) ?? [];
          const episodeFiles: EpisodeFileEntry[] = files.map((f) => {
            const fileCfs = f.customFormats ?? [];
            const fileCfIds = new Set(fileCfs.map((cf) => cf.id));
            const unwantedFormats = fileCfs
              .filter((cf) => (cfScores.get(cf.id) ?? 0) < 0)
              .map((cf) => ({
                id: cf.id,
                name: cf.name,
                score: cfScores.get(cf.id),
              }));
            return {
              id: f.id,
              seasonNumber: f.seasonNumber,
              relativePath: f.relativePath,
              customFormats: fileCfs.map((cf) => ({
                id: cf.id,
                name: cf.name,
                score: cfScores.get(cf.id),
              })),
              customFormatScore: f.customFormatScore ?? 0,
              missingFormats: positiveProfileCfs.filter(
                (cf) => !fileCfIds.has(cf.id),
              ),
              unwantedFormats,
              minProfileScore: profile.cutoffFormatScore,
              size: f.size ?? 0,
            };
          });
          const missingCfIds = new Set<number>();
          const unwantedCfIds = new Map<
            number,
            { id: number; name: string; score?: number }
          >();
          for (const ef of episodeFiles) {
            if (
              isBelowProfileScore(
                ef.customFormatScore,
                profile.cutoffFormatScore,
              )
            ) {
              ef.missingFormats.forEach((cf) => missingCfIds.add(cf.id));
            }
            ef.unwantedFormats.forEach((cf) => unwantedCfIds.set(cf.id, cf));
          }
          const missingFormats =
            files.length === 0
              ? positiveProfileCfs
              : positiveProfileCfs.filter((cf) => missingCfIds.has(cf.id));
          return {
            id: s.id,
            title: s.title,
            year: s.year,
            qualityProfileId: s.qualityProfileId,
            customFormats: [],
            customFormatScore: worstScore,
            cfScore: scoreProfileCoverage(
              worstScore,
              profile.cutoffFormatScore,
            ),
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
        return files.some((f) =>
          isMissingWantedFormats(f.customFormats ?? [], wantedIds),
        );
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
        const missingFormats = wantedCfs.filter((cf) =>
          allMissingIds.has(cf.id),
        );
        const worstCoverage =
          files.length === 0
            ? 0
            : Math.min(
                ...files.map((f) =>
                  scoreCfCoverage(f.customFormats ?? [], wantedIds),
                ),
              );
        const cfScores =
          profileScoreMap.get(s.qualityProfileId) ?? new Map<number, number>();
        const episodeFiles: EpisodeFileEntry[] = files.map((f) => ({
          id: f.id,
          seasonNumber: f.seasonNumber,
          relativePath: f.relativePath,
          customFormats:
            f.customFormats?.map((cf) => ({
              id: cf.id,
              name: cf.name,
              score: cfScores.get(cf.id),
            })) ?? [],
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

  // Re-runs a stored ActionLog payload. The discriminated-union parse
  // narrows the payload to one of the four retryable shapes; the switch
  // then dispatches without any `as` casts. TypeScript's exhaustiveness
  // check on the never-typed default makes a missing case a compile error.
  async retryFromPayload(
    payload: Record<string, unknown>,
    opts: RetryActionOptions = {},
  ): Promise<ActionLog> {
    const result = seriesRetryPayloadSchema.safeParse(payload);
    if (!result.success) {
      const action =
        typeof payload.action === "string" ? payload.action : "unknown";
      throw badRequest(`Cannot retry action type: ${action}`);
    }
    const data = result.data;
    switch (data.action) {
      case "search":
        return this.triggerSearch(
          data.instanceId,
          data.mediaId,
          data.title,
          opts,
        );
      case "search_season":
        return this.triggerSeasonSearch(
          data.instanceId,
          data.mediaId,
          data.seasonNumber,
          data.title,
          opts,
        );
      case "search_episode":
        return this.triggerEpisodeFileSearch(
          data.instanceId,
          data.mediaId,
          data.fileId,
          data.title,
          opts,
        );
      case "delete":
        return this.deleteFiles(
          data.instanceId,
          data.mediaId,
          data.fileIds,
          data.title,
          data.triggerSearch ?? false,
          opts,
        );
      default: {
        const _exhaustive: never = data;
        throw new Error(`Unhandled action: ${String(_exhaustive)}`);
      }
    }
  }

  async deleteFiles(
    instanceId: number,
    mediaId: number,
    fileIds: number[],
    title: string,
    triggerSearch = false,
    opts: RetryActionOptions = {},
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
      payload: {
        instanceId,
        action: "delete",
        mediaId,
        fileIds,
        title,
        triggerSearch,
      },
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
    opts: RetryActionOptions = {},
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
    opts: RetryActionOptions = {},
  ): Promise<ActionLog> {
    const instance = await instanceRepository.findById(instanceId);
    if (!instance) throw new Error(`Instance ${instanceId} not found`);
    const client = ArrClientFactory.createArrClient(instance) as SonarrClient;

    return this.executeAction({
      instanceName: instance.name,
      instanceId,
      action: "search_season",
      mediaId,
      title,
      actionLogId: opts.actionLogId,
      payload: {
        instanceId,
        action: "search_season",
        mediaId,
        seasonNumber,
        title,
      },
      run: () => client.triggerSeasonSearch(mediaId, seasonNumber),
    });
  }

  async triggerEpisodeFileSearch(
    instanceId: number,
    mediaId: number,
    fileId: number,
    title: string,
    opts: RetryActionOptions = {},
  ): Promise<ActionLog> {
    const instance = await instanceRepository.findById(instanceId);
    if (!instance) throw new Error(`Instance ${instanceId} not found`);
    const client = ArrClientFactory.createArrClient(instance) as SonarrClient;

    return this.executeAction({
      instanceName: instance.name,
      instanceId,
      action: "search_episode",
      mediaId,
      title,
      actionLogId: opts.actionLogId,
      payload: { instanceId, action: "search_episode", mediaId, fileId, title },
      run: async () => {
        const episodes = await client.getEpisodes(mediaId);
        const episodeIds = episodes
          .filter((e) => e.episodeFileId === fileId)
          .map((e) => e.id);
        if (episodeIds.length === 0)
          throw new Error("Episode not found for file");
        await client.triggerEpisodeSearch(episodeIds);
      },
    });
  }
}

export const seriesService = new SeriesService();
