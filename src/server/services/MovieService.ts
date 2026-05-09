import { instanceRepository } from "@/server/repositories/InstanceRepository";
import { ArrClientFactory } from "@/server/clients/ArrClientFactory";
import type {
  RadarrClient,
  RadarrMovieFile,
} from "@/server/clients/RadarrClient";
import { appLogger } from "@/server/lib/app-logger";
import { badRequest } from "@/server/lib/api-errors";
import { LogSource } from "@/shared/types/models";
import {
  isMissingWantedFormats,
  getMissingFormats,
  scoreCfCoverage,
  isBelowProfileScore,
  scoreProfileCoverage,
} from "@/shared/scoring";
import { movieRetryPayloadSchema } from "@/shared/types/schemas";
import type {
  CustomFormat,
  MovieItem,
  ActionLog,
  MediaQuery,
  ScoringMode,
} from "@/shared/types/models";
import { MediaService } from "./MediaService";
import type { RetryActionOptions } from "./media-services";

// Local shorthand for the RadarrMovie shape — derived from the client's
// return type since `RadarrMovie` is internal to `RadarrClient.ts`.
type RadarrMovie = Awaited<ReturnType<RadarrClient["getMovies"]>>[number];

type ProfileCtx = {
  item: RadarrMovie;
  file: RadarrMovieFile | undefined;
  profile: { cutoffFormatScore: number };
  cfScoreMap: Map<number, number>;
  positiveProfileCfs: CustomFormat[];
};

type ManualCtx = {
  item: RadarrMovie;
  file: RadarrMovieFile | undefined;
  wantedIds: number[];
  wantedCfs: Array<{ id: number; name: string }>;
};

export class MovieService extends MediaService<MovieItem> {
  protected readonly cacheNamespace = "movies";

  protected getForWarm(
    instanceId: number,
    query: MediaQuery,
  ): Promise<{ items: MovieItem[]; total: number }> {
    return this.getMovies(instanceId, query);
  }

  async getMovies(
    instanceId: number,
    query: MediaQuery,
  ): Promise<{ items: MovieItem[]; total: number }> {
    const instance = await instanceRepository.findById(instanceId);
    if (!instance) throw new Error(`Instance ${instanceId} not found`);

    const mode = query.scoringModeOverride ?? instance.scoringMode;
    const cacheKey = this.mediaCacheKey(instanceId, mode);
    const cached = await this.readWithSwr<{ items: MovieItem[] }>({
      cacheKey,
      instanceId: instance.id,
      logSource: LogSource.MovieService,
      backgroundErrorMessage: "Background movies rebuild failed",
      build: () => this.buildAndLog(instance.id, instance, mode),
    });
    return this.applyQuery(
      cached.items,
      this.enforceShowAllMedia(query, instance),
      mode,
    );
  }

  private async buildAndLog(
    instanceId: number,
    instance: NonNullable<
      Awaited<ReturnType<typeof instanceRepository.findById>>
    >,
    mode: ScoringMode,
  ): Promise<{ items: MovieItem[] }> {
    const startedAt = Date.now();
    const items = await this.buildMovies(instance, mode);
    appLogger.debug("Built movies cache", {
      source: LogSource.MovieService,
      context: {
        instanceId,
        instanceName: instance.name,
        mode,
        items: items.length,
        flagged: items.filter((m) => m.flagged).length,
        durationMs: Date.now() - startedAt,
      },
    });
    return { items };
  }

  private async buildMovies(
    instance: NonNullable<
      Awaited<ReturnType<typeof instanceRepository.findById>>
    >,
    mode: ScoringMode,
  ): Promise<MovieItem[]> {
    const client = ArrClientFactory.createArrClient(instance) as RadarrClient;
    const [movies, profiles] = await Promise.all([
      client.getMovies(),
      client.getQualityProfiles(),
    ]);

    const fileIds = movies
      .filter((m) => m.hasFile && m.movieFileId > 0)
      .map((m) => m.movieFileId);
    const movieFiles = await client.getMovieFilesByIds(fileIds);
    const fileMap = new Map(movieFiles.map((f) => [f.movieId, f]));

    return this.runBuildPipeline<RadarrMovie, RadarrMovieFile | undefined>({
      instance,
      mode,
      mediaType: "movie",
      items: movies,
      profiles,
      filesFor: (m) => fileMap.get(m.id),
      toProfileItem: (ctx) => this.toMovieProfileItem(ctx),
      toManualItem: (ctx) =>
        this.toMovieManualItem({
          item: ctx.item,
          file: ctx.file,
          wantedIds: ctx.wantedIds,
          wantedCfs: ctx.wantedCfs,
        }),
    });
  }

  private toMovieProfileItem(ctx: ProfileCtx): MovieItem {
    const { item, file, profile, cfScoreMap, positiveProfileCfs } = ctx;
    const score = file?.customFormatScore ?? 0;
    const fileCfs = file?.customFormats ?? [];
    const { customFormats, missingFormats, unwantedFormats } =
      this.decorateCustomFormats({
        fileCfs,
        cfScoreMap,
        positiveProfileCfs,
      });
    return {
      id: item.id,
      title: item.title,
      year: item.year,
      qualityProfileId: item.qualityProfileId,
      movieFileId: item.movieFileId,
      customFormats,
      customFormatScore: score,
      hasFile: item.hasFile,
      cfScore: scoreProfileCoverage(score, profile.cutoffFormatScore),
      missingFormats,
      unwantedFormats,
      minProfileScore: profile.cutoffFormatScore,
      sizeOnDisk: file?.size ?? 0,
      monitored: item.monitored,
      existingFileCount: item.hasFile ? 1 : 0,
      totalFileCount: 1,
      flagged: isBelowProfileScore(score, profile.cutoffFormatScore),
    };
  }

  private toMovieManualItem(ctx: ManualCtx): MovieItem {
    const { item, file, wantedIds, wantedCfs } = ctx;
    const fileCfs = file?.customFormats ?? [];
    // Manual mode doesn't decorate against a profile's positive CFs —
    // missingFormats is computed against the user's wanted-CF prefs.
    // We only enrich each file CF with score=undefined (no profile
    // context to source it from).
    const formats = fileCfs.map((cf) => ({
      id: cf.id,
      name: cf.name,
      score: undefined,
    }));
    // Manual-mode flagged predicate: no file at all OR file is missing
    // any of the user's wanted CFs. With zero prefs configured no
    // movie can be flagged — flagged stays false for every item, but
    // they all still appear in the cache for the "Show all" view.
    const flagged =
      wantedIds.length > 0 &&
      (!item.hasFile || isMissingWantedFormats(fileCfs, wantedIds));
    return {
      id: item.id,
      title: item.title,
      year: item.year,
      qualityProfileId: item.qualityProfileId,
      movieFileId: item.movieFileId,
      customFormats: formats,
      customFormatScore: file?.customFormatScore ?? 0,
      hasFile: item.hasFile,
      cfScore: item.hasFile ? scoreCfCoverage(formats, wantedIds) : 0,
      missingFormats: getMissingFormats(formats, wantedCfs),
      unwantedFormats: [],
      sizeOnDisk: file?.size ?? 0,
      monitored: item.monitored,
      existingFileCount: item.hasFile ? 1 : 0,
      totalFileCount: 1,
      flagged,
    };
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
    const { instance, client } = await this.withClient(instanceId);

    return this.executeAction({
      instanceName: instance.name,
      instanceId,
      action: "search",
      mediaId,
      title,
      actionLogId: opts.actionLogId,
      groupId: opts.groupId,
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
    const { instance, client } = await this.withClient(instanceId);

    return this.executeAction({
      instanceName: instance.name,
      instanceId,
      action: "delete",
      mediaId,
      title,
      actionLogId: opts.actionLogId,
      groupId: opts.groupId,
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
