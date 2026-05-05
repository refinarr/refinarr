import type { FlaggedMovie, ActionLog, MediaQuery, ScoringMode } from "@/shared/types/models";
import { movieRetryPayloadSchema } from "@/shared/types/schemas";
import { isProfileMode } from "@/shared/scoring-mode";
import { MediaService } from "./MediaService";
import { instanceRepository } from "@/server/repositories/InstanceRepository";
import { preferenceRepository } from "@/server/repositories/PreferenceRepository";
import { ignoreRepository } from "@/server/repositories/IgnoreRepository";
import { ArrClientFactory } from "@/server/clients/ArrClientFactory";
import { RadarrClient } from "@/server/clients/RadarrClient";
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
import { RetryNotSupportedError } from "./retry-errors";
import type { RetryActionOptions } from "./media-services";


export class MovieService extends MediaService {
  async getFlaggedMovies(
    instanceId: number,
    query: MediaQuery
  ): Promise<{ items: FlaggedMovie[]; total: number }> {
    const instance = await instanceRepository.findById(instanceId);
    if (!instance) throw new Error(`Instance ${instanceId} not found`);

    const mode = instance.scoringMode;
    const cacheKey = `movies:${instanceId}:${mode}`;
    let cached = dataCache.get<{ flagged: FlaggedMovie[] }>(cacheKey, CACHE_TTL_MS);

    if (cached) {
      appLogger.debug("Cache hit", { source: LogSource.MovieService, context: { cacheKey } });
    } else {
      const startedAt = Date.now();
      const flagged = await this.buildFlaggedMovies(instanceId, instance, mode);
      cached = { flagged };
      dataCache.set(cacheKey, cached);
      appLogger.debug("Built flagged movies cache", {
        source: LogSource.MovieService,
        context: {
          instanceId,
          instanceName: instance.name,
          mode,
          flagged: flagged.length,
          durationMs: Date.now() - startedAt,
        },
      });
    }

    return this.applyQuery(cached.flagged, query, mode, (m) => m.hasFile);
  }

  private async buildFlaggedMovies(
    instanceId: number,
    instance: Awaited<ReturnType<typeof instanceRepository.findById>>,
    mode: ScoringMode
  ): Promise<FlaggedMovie[]> {
    const client = ArrClientFactory.createArrClient(instance!) as RadarrClient;
    const [movies, profiles] = await Promise.all([
      client.getMovies(),
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

    const fileIds = movies.filter((m) => m.hasFile && m.movieFileId > 0).map((m) => m.movieFileId);
    const movieFiles = await client.getMovieFilesByIds(fileIds);
    const fileMap = new Map(movieFiles.map((f) => [f.movieId, f]));

    const ignoredSet = new Set(
      (await ignoreRepository.findByInstance(instanceId))
        .filter((e) => e.mediaType === "movie")
        .map((e) => e.mediaId)
    );

    if (isProfileMode(mode)) {
      return movies
        .filter((m) => !ignoredSet.has(m.id))
        .filter((m) => {
          const profile = profileMap.get(m.qualityProfileId);
          if (!profile) return false;
          const score = fileMap.get(m.id)?.customFormatScore ?? 0;
          return isBelowProfileScore(score, profile.cutoffFormatScore);
        })
        .map((m) => {
          const profile = profileMap.get(m.qualityProfileId)!;
          const file = fileMap.get(m.id);
          const score = file?.customFormatScore ?? 0;
          const cfScores = profileScoreMap.get(m.qualityProfileId) ?? new Map<number, number>();
          const positiveProfileCfs = profileFormatMap.get(m.qualityProfileId) ?? [];
          const fileCfs = file?.customFormats ?? [];
          const fileCfIds = new Set(fileCfs.map((cf) => cf.id));
          const unwantedFormats = fileCfs
            .filter((cf) => (cfScores.get(cf.id) ?? 0) < 0)
            .map((cf) => ({ id: cf.id, name: cf.name, score: cfScores.get(cf.id) }));
          return {
            id: m.id,
            title: m.title,
            year: m.year,
            qualityProfileId: m.qualityProfileId,
            movieFileId: m.movieFileId,
            customFormats: fileCfs.map((cf) => ({ id: cf.id, name: cf.name, score: cfScores.get(cf.id) })),
            customFormatScore: score,
            hasFile: m.hasFile,
            cfScore: scoreProfileCoverage(score, profile.cutoffFormatScore),
            missingFormats: positiveProfileCfs.filter((cf) => !fileCfIds.has(cf.id)),
            unwantedFormats,
            minProfileScore: profile.cutoffFormatScore,
            sizeOnDisk: file?.size ?? 0,
          };
        });
    }

    const prefs = await preferenceRepository.findByInstance(instanceId);
    if (prefs.length === 0) return [];

    const wantedIds = prefs.map((p) => p.cfId);
    const wantedCfs = prefs.map((p) => ({ id: p.cfId, name: p.cfName }));

    return movies
      .filter((m) => !ignoredSet.has(m.id))
      .filter((m) => {
        if (!m.hasFile) return true;
        return isMissingWantedFormats(fileMap.get(m.id)?.customFormats ?? [], wantedIds);
      })
      .map((m) => {
        const file = fileMap.get(m.id);
        const cfScores = profileScoreMap.get(m.qualityProfileId) ?? new Map<number, number>();
        const formats = file?.customFormats?.map(cf => ({ id: cf.id, name: cf.name, score: cfScores.get(cf.id) })) ?? [];
        return {
          id: m.id,
          title: m.title,
          year: m.year,
          qualityProfileId: m.qualityProfileId,
          movieFileId: m.movieFileId,
          customFormats: formats,
          customFormatScore: file?.customFormatScore ?? 0,
          hasFile: m.hasFile,
          cfScore: m.hasFile ? scoreCfCoverage(formats, wantedIds) : 0,
          missingFormats: getMissingFormats(formats, wantedCfs),
          unwantedFormats: [],
          sizeOnDisk: file?.size ?? 0,
        };
      });
  }

  // Returns the flagged-count from cache if warm, or null if cold. Used by
  // the dashboard summary route to avoid triggering a multi-second upstream
  // build inline. Caller is responsible for kicking off a background warm
  // when null is returned.
  getCachedFlaggedTotal(instanceId: number, mode: ScoringMode): number | null {
    const cached = dataCache.get<{ flagged: FlaggedMovie[] }>(
      `movies:${instanceId}:${mode}`,
      CACHE_TTL_MS,
    );
    return cached?.flagged.length ?? null;
  }

  // Uniform name across MovieService / SeriesService for use via
  // mediaServiceFor(arrType) in routes that don't care which media type.
  // Warms the flagged-media cache by issuing a minimal getFlaggedMovies
  // call. Errors propagate to the caller (the dashboard route swallows
  // them since this is fire-and-forget).
  warmFlaggedCache(instanceId: number): Promise<unknown> {
    return this.getFlaggedMovies(instanceId, { page: 1, limit: 1, sortBy: "score", order: "asc" });
  }

  // Re-runs a stored ActionLog payload. Movies-specific fields:
  //   - search: { instanceId, mediaId, title }
  //   - delete: { instanceId, mediaId, fileId, title, triggerSearch? }
  //     (legacy rows stamped action="delete_blacklist" inside the payload;
  //     the schema still accepts them, the migration backfills them to
  //     "delete" so the action-parity guard passes)
  async retryFromPayload(payload: Record<string, unknown>, opts: RetryActionOptions = {}): Promise<ActionLog> {
    const result = movieRetryPayloadSchema.safeParse(payload);
    if (!result.success) {
      const action = typeof payload.action === "string" ? payload.action : "unknown";
      throw new RetryNotSupportedError(action);
    }
    const data = result.data;
    switch (data.action) {
      case "search":
        return this.triggerSearch(data.instanceId, data.mediaId, data.title, opts);
      case "delete":
      case "delete_blacklist":
        return this.deleteFile(
          data.instanceId, data.mediaId, data.fileId, data.title,
          data.triggerSearch ?? true, opts,
        );
      default: {
        const _exhaustive: never = data;
        throw new Error(`Unhandled action: ${String(_exhaustive)}`);
      }
    }
  }

  async triggerSearch(
    instanceId: number,
    mediaId: number,
    title: string,
    opts: RetryActionOptions = {}
  ): Promise<ActionLog> {
    const instance = await instanceRepository.findById(instanceId);
    if (!instance) throw new Error(`Instance ${instanceId} not found`);
    const client = ArrClientFactory.createArrClient(instance) as RadarrClient;

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

  async deleteFile(
    instanceId: number,
    mediaId: number,
    fileId: number,
    title: string,
    triggerSearch = true,
    opts: RetryActionOptions = {}
  ): Promise<ActionLog> {
    const instance = await instanceRepository.findById(instanceId);
    if (!instance) throw new Error(`Instance ${instanceId} not found`);
    const client = ArrClientFactory.createArrClient(instance) as RadarrClient;

    return this.executeAction({
      instanceName: instance.name,
      instanceId,
      action: "delete",
      mediaId,
      title,
      actionLogId: opts.actionLogId,
      payload: { instanceId, action: "delete", mediaId, fileId, title, triggerSearch },
      run: async () => {
        await client.deleteFile(fileId);
        if (triggerSearch) await client.triggerSearch(mediaId);
      },
    });
  }
}

export const movieService = new MovieService();
