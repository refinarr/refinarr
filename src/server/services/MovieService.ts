import { instanceRepository } from "@/server/repositories/InstanceRepository";
import { preferenceRepository } from "@/server/repositories/PreferenceRepository";
import { ignoreRepository } from "@/server/repositories/IgnoreRepository";
import { ArrClientFactory } from "@/server/clients/ArrClientFactory";
import { RadarrClient } from "@/server/clients/RadarrClient";
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
import { movieRetryPayloadSchema } from "@/shared/types/schemas";
import type {
  CustomFormat,
  FlaggedMovie,
  ActionLog,
  MediaQuery,
  ScoringMode,
} from "@/shared/types/models";
import { MediaService } from "./MediaService";
import type { RetryActionOptions } from "./media-services";

export class MovieService extends MediaService<FlaggedMovie> {
  protected readonly cacheNamespace = "movies";

  protected getFlaggedForWarm(
    instanceId: number,
    query: MediaQuery,
  ): Promise<{ items: FlaggedMovie[]; total: number }> {
    return this.getFlaggedMovies(instanceId, query);
  }

  async getFlaggedMovies(
    instanceId: number,
    query: MediaQuery,
  ): Promise<{ items: FlaggedMovie[]; total: number }> {
    const instance = await instanceRepository.findById(instanceId);
    if (!instance) throw new Error(`Instance ${instanceId} not found`);

    const mode = instance.scoringMode;
    const cacheKey = this.flaggedCacheKey(instanceId, mode);
    const cached = await this.readWithSwr<{ flagged: FlaggedMovie[] }>({
      cacheKey,
      instanceId: instance.id,
      logSource: LogSource.MovieService,
      backgroundErrorMessage: "Background flagged-movies rebuild failed",
      build: () => this.buildFlaggedAndLog(instance.id, instance, mode),
    });
    return this.applyQuery(cached.flagged, query, mode, (m) => m.hasFile);
  }

  private async buildFlaggedAndLog(
    instanceId: number,
    instance: NonNullable<
      Awaited<ReturnType<typeof instanceRepository.findById>>
    >,
    mode: ScoringMode,
  ): Promise<{ flagged: FlaggedMovie[] }> {
    const startedAt = Date.now();
    const flagged = await this.buildFlaggedMovies(instanceId, instance, mode);
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
    return { flagged };
  }

  private async buildFlaggedMovies(
    instanceId: number,
    instance: Awaited<ReturnType<typeof instanceRepository.findById>>,
    mode: ScoringMode,
  ): Promise<FlaggedMovie[]> {
    const client = ArrClientFactory.createArrClient(instance!) as RadarrClient;
    const [movies, profiles] = await Promise.all([
      client.getMovies(),
      client.getQualityProfiles(),
    ]);

    const profileMap = new Map(profiles.map((p) => [p.id, p]));
    const profileScoreMap = new Map<number, Map<number, number>>();
    // Profile-rewarded ("positive") CFs per profile. Typed as CustomFormat[]
    // so downstream `missingFormats` carries score (matches the declared
    // FlaggedMedia.missingFormats type — previously the score was silently
    // dropped because TypeScript accepted the narrower {id, name} via the
    // optional score field).
    const profileFormatMap = new Map<number, CustomFormat[]>();
    for (const p of profiles) {
      const cfMap = new Map<number, number>();
      for (const item of p.formatItems) cfMap.set(item.format, item.score);
      profileScoreMap.set(p.id, cfMap);
      profileFormatMap.set(
        p.id,
        p.formatItems
          .filter((item) => item.score > 0)
          .map((item) => ({
            id: item.format,
            name: item.name,
            score: item.score,
          })),
      );
    }

    const fileIds = movies
      .filter((m) => m.hasFile && m.movieFileId > 0)
      .map((m) => m.movieFileId);
    const movieFiles = await client.getMovieFilesByIds(fileIds);
    const fileMap = new Map(movieFiles.map((f) => [f.movieId, f]));

    const ignoredSet = new Set(
      (await ignoreRepository.findByInstance(instanceId))
        .filter((e) => e.mediaType === "movie")
        .map((e) => e.mediaId),
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
          const cfScores =
            profileScoreMap.get(m.qualityProfileId) ??
            new Map<number, number>();
          const positiveProfileCfs =
            profileFormatMap.get(m.qualityProfileId) ?? [];
          const fileCfs = file?.customFormats ?? [];
          const fileCfIds = new Set(fileCfs.map((cf) => cf.id));
          const unwantedFormats = fileCfs
            .filter((cf) => (cfScores.get(cf.id) ?? 0) < 0)
            .map((cf) => ({
              id: cf.id,
              name: cf.name,
              score: cfScores.get(cf.id),
            }));
          return {
            id: m.id,
            title: m.title,
            year: m.year,
            qualityProfileId: m.qualityProfileId,
            movieFileId: m.movieFileId,
            customFormats: fileCfs.map((cf) => ({
              id: cf.id,
              name: cf.name,
              score: cfScores.get(cf.id),
            })),
            customFormatScore: score,
            hasFile: m.hasFile,
            cfScore: scoreProfileCoverage(score, profile.cutoffFormatScore),
            missingFormats: positiveProfileCfs.filter(
              (cf) => !fileCfIds.has(cf.id),
            ),
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
        return isMissingWantedFormats(
          fileMap.get(m.id)?.customFormats ?? [],
          wantedIds,
        );
      })
      .map((m) => {
        const file = fileMap.get(m.id);
        const cfScores =
          profileScoreMap.get(m.qualityProfileId) ?? new Map<number, number>();
        const formats =
          file?.customFormats?.map((cf) => ({
            id: cf.id,
            name: cf.name,
            score: cfScores.get(cf.id),
          })) ?? [];
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

  // Re-runs a stored ActionLog payload. Movies-specific fields:
  //   - search: { instanceId, mediaId, title }
  //   - delete: { instanceId, mediaId, fileId, title, triggerSearch? }
  //     (legacy rows stamped action="delete_blacklist" inside the payload;
  //     the schema still accepts them, the migration backfills them to
  //     "delete" so the action-parity guard passes)
  async retryFromPayload(
    payload: Record<string, unknown>,
    opts: RetryActionOptions = {},
  ): Promise<ActionLog> {
    const result = movieRetryPayloadSchema.safeParse(payload);
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
      case "delete":
      case "delete_blacklist":
        return this.deleteFile(
          data.instanceId,
          data.mediaId,
          data.fileId,
          data.title,
          data.triggerSearch ?? true,
          opts,
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
    opts: RetryActionOptions = {},
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
    opts: RetryActionOptions = {},
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
      payload: {
        instanceId,
        action: "delete",
        mediaId,
        fileId,
        title,
        triggerSearch,
      },
      run: async () => {
        await client.deleteFile(fileId);
        if (triggerSearch) await client.triggerSearch(mediaId);
      },
    });
  }
}

export const movieService = new MovieService();
