import { instanceRepository } from "@/server/repositories/InstanceRepository";
import type {
  RadarrClient,
  RadarrMovieFile,
} from "@/server/clients/RadarrClient";
import { appLogger } from "@/server/lib/app-logger";
import { badRequest } from "@/server/lib/api-errors";
import type {
  MediaServiceFacade,
  RetryActionOptions,
} from "@/server/arr/media-service-facade";
import { LogSource } from "@/shared/types/models";
import { isBelowProfileScore, scoreProfileCoverage } from "@/shared/scoring";
import { movieRetryPayloadSchema } from "@/shared/types/schemas";
import type {
  CustomFormat,
  MovieItem,
  ActionLog,
  MediaQuery,
} from "@/shared/types/models";
import type { ReleaseCandidate } from "@/shared/types/api";
import { MediaService } from "./MediaService";

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

export class MovieService
  extends MediaService<MovieItem>
  implements MediaServiceFacade
{
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

    const cacheKey = this.mediaCacheKey(instanceId);
    const cached = await this.readWithSwr<{ items: MovieItem[] }>({
      cacheKey,
      instanceId: instance.id,
      logSource: LogSource.MovieService,
      backgroundErrorMessage: "Background movies rebuild failed",
      build: () => this.buildAndLog(instance.id, instance),
    });
    return this.applyQuery(
      cached.items,
      this.enforceShowAllMedia(query, instance),
    );
  }

  private async buildAndLog(
    instanceId: number,
    instance: NonNullable<
      Awaited<ReturnType<typeof instanceRepository.findById>>
    >,
  ): Promise<{ items: MovieItem[] }> {
    const startedAt = Date.now();
    const items = await this.buildMovies(instance);
    appLogger.debug("Built movies cache", {
      source: LogSource.MovieService,
      context: {
        instanceId,
        instanceName: instance.name,
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
  ): Promise<MovieItem[]> {
    const client = this.clientFromInstance(instance, "radarr");
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
      mediaType: "movie",
      items: movies,
      profiles,
      filesFor: (m) => fileMap.get(m.id),
      toItem: (ctx) => this.toMovieItem(ctx),
    });
  }

  private toMovieItem(ctx: ProfileCtx): MovieItem {
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

  // Re-runs a stored ActionLog payload. Movies-specific fields:
  //   - search: { instanceId, mediaId, title }
  //   - delete: { instanceId, mediaId, fileId, title }
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
        return this.deleteFile(
          data.instanceId,
          data.mediaId,
          data.fileId,
          data.title,
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

  // Interactive search — candidate releases for a movie, each with its CF
  // score + rejection reasons. Read-only; not an ActionLog action.
  getReleases(
    instanceId: number,
    movieId: number,
  ): Promise<ReleaseCandidate[]> {
    return this.withClient(instanceId, "radarr").then(({ client }) =>
      client.getReleases(movieId),
    );
  }

  // Force-grab a specific release. Lands the row at "grabbed" (POST
  // /release returns no commandId) and stores no payload, so it's
  // non-retryable (release guids expire) and dry-run-safe via executeAction.
  async grabRelease(
    instanceId: number,
    movieId: number,
    release: { guid: string; indexerId: number },
    title: string,
    opts: RetryActionOptions = {},
  ): Promise<ActionLog> {
    const { instance, client } = await this.withClient(instanceId, "radarr");

    return this.executeAction({
      instanceName: instance.name,
      instanceId,
      action: "grab",
      mediaId: movieId,
      title,
      groupId: opts.groupId,
      successStatus: "grabbed",
      run: () =>
        client.grabRelease({
          guid: release.guid,
          indexerId: release.indexerId,
          movieId,
        }),
    });
  }

  async deleteFile(
    instanceId: number,
    mediaId: number,
    fileId: number,
    title: string,
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
      },
      run: async () => {
        await client.deleteFile(fileId);
      },
    });
  }
}

// Singleton lives in `@/server/arr/composition` (along with the
// sonarr/series counterpart) so it can be wired with the DI deps the
// MediaService base now requires. Consumers import `movieService` from
// there instead of from this file.
