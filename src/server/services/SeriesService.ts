import { instanceRepository } from "@/server/repositories/InstanceRepository";
import { ArrClientFactory } from "@/server/clients/ArrClientFactory";
// Type-only — `SonarrClient` shows up in a type assertion inside
// `buildSeries` (the factory still constructs the real subclass;
// no value-level import keeps the "subclasses constructed only via
// ArrClientFactory" rule intact).
import type {
  SonarrClient,
  SonarrEpisodeFile,
} from "@/server/clients/SonarrClient";
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
import { seriesRetryPayloadSchema } from "@/shared/types/schemas";
import type {
  CustomFormat,
  SeriesItem,
  EpisodeFileEntry,
  ActionLog,
  MediaQuery,
  ScoringMode,
} from "@/shared/types/models";
import { MediaService } from "./MediaService";
import type { RetryActionOptions } from "./media-services";

// Local shorthand for the SonarrSeries shape — derived from the client's
// return type since `SonarrSeries` is internal to `SonarrClient.ts`.
type SonarrSeries = Awaited<ReturnType<SonarrClient["getSeries"]>>[number];

type ProfileCtx = {
  item: SonarrSeries;
  file: SonarrEpisodeFile[];
  profile: { cutoffFormatScore: number };
  cfScoreMap: Map<number, number>;
  positiveProfileCfs: CustomFormat[];
};

type ManualCtx = {
  item: SonarrSeries;
  file: SonarrEpisodeFile[];
  profileMaps: { scoresByProfile: Map<number, Map<number, number>> };
  wantedIds: number[];
  wantedCfs: Array<{ id: number; name: string }>;
};

// Per-series file counts derived from upstream `seasons[].statistics`.
// Used both for the MediaItem.{existingFileCount,totalFileCount}
// fields and to derive whether a series is "missing" episodes.
function fileCounts(s: SonarrSeries): { existing: number; total: number } {
  return (s.seasons ?? []).reduce(
    (acc, season) => ({
      existing: acc.existing + (season.statistics?.episodeFileCount ?? 0),
      total: acc.total + (season.statistics?.episodeCount ?? 0),
    }),
    { existing: 0, total: 0 },
  );
}

export class SeriesService extends MediaService<SeriesItem> {
  protected readonly cacheNamespace = "series";

  protected getForWarm(
    instanceId: number,
    query: MediaQuery,
  ): Promise<{ items: SeriesItem[]; total: number }> {
    return this.getSeries(instanceId, query);
  }

  async getSeries(
    instanceId: number,
    query: MediaQuery,
  ): Promise<{ items: SeriesItem[]; total: number }> {
    const instance = await instanceRepository.findById(instanceId);
    if (!instance) throw new Error(`Instance ${instanceId} not found`);

    const mode = instance.scoringMode;
    const cacheKey = this.mediaCacheKey(instanceId, mode);
    const cached = await this.readWithSwr<{ items: SeriesItem[] }>({
      cacheKey,
      instanceId: instance.id,
      logSource: LogSource.SeriesService,
      backgroundErrorMessage: "Background series rebuild failed",
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
  ): Promise<{ items: SeriesItem[] }> {
    const startedAt = Date.now();
    const items = await this.buildSeries(instance, mode);
    appLogger.debug("Built series cache", {
      source: LogSource.SeriesService,
      context: {
        instanceId,
        instanceName: instance.name,
        mode,
        items: items.length,
        flagged: items.filter((s) => s.flagged).length,
        durationMs: Date.now() - startedAt,
      },
    });
    return { items };
  }

  private async buildSeries(
    instance: NonNullable<
      Awaited<ReturnType<typeof instanceRepository.findById>>
    >,
    mode: ScoringMode,
  ): Promise<SeriesItem[]> {
    const client = ArrClientFactory.createArrClient(instance) as SonarrClient;
    const [series, profiles] = await Promise.all([
      client.getSeries(),
      client.getQualityProfiles(),
    ]);

    // Episode-files prefetch: scope to the series we're going to render so
    // we don't pay for getAllEpisodeFiles on ignored ids. The pipeline
    // also filters ignored ids; this is the upstream-call optimisation.
    const seriesIds = series.map((s) => s.id);
    const episodeFilesMap = await client.getAllEpisodeFiles(seriesIds);

    return this.runBuildPipeline<SonarrSeries, SonarrEpisodeFile[]>({
      instance,
      mode,
      mediaType: "series",
      items: series,
      profiles,
      filesFor: (s) => episodeFilesMap.get(s.id) ?? [],
      toProfileItem: (ctx) => this.toSeriesProfileItem(ctx),
      toManualItem: (ctx) =>
        this.toSeriesManualItem({
          item: ctx.item,
          file: ctx.file,
          profileMaps: ctx.profileMaps,
          wantedIds: ctx.wantedIds,
          wantedCfs: ctx.wantedCfs,
        }),
    });
  }

  private toSeriesProfileItem(ctx: ProfileCtx): SeriesItem {
    const {
      item: s,
      file: files,
      profile,
      cfScoreMap,
      positiveProfileCfs,
    } = ctx;
    const worstScore = files.length
      ? Math.min(...files.map((f) => f.customFormatScore ?? 0))
      : 0;
    const affectedEpisodeCount = files.filter((f) =>
      isBelowProfileScore(f.customFormatScore ?? 0, profile.cutoffFormatScore),
    ).length;
    const counts = fileCounts(s);
    // Flagged in profile mode: at least one episode below cutoff,
    // or no files yet under a profile that expects positive scoring.
    const flagged =
      files.length === 0
        ? profile.cutoffFormatScore > 0
        : files.some((f) =>
            isBelowProfileScore(
              f.customFormatScore ?? 0,
              profile.cutoffFormatScore,
            ),
          );

    const episodeFiles: EpisodeFileEntry[] = files.map((f) => {
      const fileCfs = f.customFormats ?? [];
      const decorated = this.decorateCustomFormats({
        fileCfs,
        cfScoreMap,
        positiveProfileCfs,
      });
      return {
        id: f.id,
        seasonNumber: f.seasonNumber,
        relativePath: f.relativePath,
        customFormats: decorated.customFormats,
        customFormatScore: f.customFormatScore ?? 0,
        missingFormats: decorated.missingFormats,
        unwantedFormats: decorated.unwantedFormats,
        minProfileScore: profile.cutoffFormatScore,
        size: f.size ?? 0,
      };
    });

    // Series-level CF rollup: union of missing CFs across episodes that
    // are themselves below cutoff (so we don't surface a "missing CF" on
    // the series row when every episode that lacks it is already above
    // cutoff via other CFs), and the union of unwanted CFs across all
    // episodes (a single negative CF anywhere on the series should
    // surface).
    const missingCfIds = new Set<number>();
    const unwantedCfMap = new Map<number, CustomFormat>();
    for (const ef of episodeFiles) {
      if (
        isBelowProfileScore(ef.customFormatScore, profile.cutoffFormatScore)
      ) {
        ef.missingFormats.forEach((cf) => missingCfIds.add(cf.id));
      }
      ef.unwantedFormats.forEach((cf) => unwantedCfMap.set(cf.id, cf));
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
      cfScore: scoreProfileCoverage(worstScore, profile.cutoffFormatScore),
      missingFormats,
      unwantedFormats: Array.from(unwantedCfMap.values()),
      minProfileScore: profile.cutoffFormatScore,
      affectedEpisodeCount,
      totalEpisodeCount: files.length,
      episodeFiles,
      sizeOnDisk: files.reduce((acc, f) => acc + (f.size ?? 0), 0),
      monitored: s.monitored,
      existingFileCount: counts.existing,
      totalFileCount: counts.total,
      flagged,
    };
  }

  private toSeriesManualItem(ctx: ManualCtx): SeriesItem {
    const { item: s, file: files, profileMaps, wantedIds, wantedCfs } = ctx;
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
    const worstCoverage =
      files.length === 0
        ? 0
        : Math.min(
            ...files.map((f) =>
              scoreCfCoverage(f.customFormats ?? [], wantedIds),
            ),
          );
    const cfScores =
      profileMaps.scoresByProfile.get(s.qualityProfileId) ??
      new Map<number, number>();
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
    const counts = fileCounts(s);
    // Manual-mode flagged predicate: at least one episode is missing
    // any of the user's wanted CFs. With zero prefs configured no
    // series can be flagged — flagged stays false but every series
    // still appears in the cache for the "Show all" view. A series
    // with no episode files is flagged when prefs exist (every
    // wanted CF is missing by definition).
    const flagged =
      wantedIds.length > 0 &&
      (files.length === 0 ||
        files.some((f) =>
          isMissingWantedFormats(f.customFormats ?? [], wantedIds),
        ));
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
      monitored: s.monitored,
      existingFileCount: counts.existing,
      totalFileCount: counts.total,
      flagged,
    };
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
    // No SonarrClient cast — base ArrClient.deleteFile + triggerSearch
    // cover everything this method needs.
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
        fileIds,
        title,
        triggerSearch,
      },
      run: async () => {
        for (const fileId of fileIds) {
          await client.deleteFile(fileId);
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

  async triggerSeasonSearch(
    instanceId: number,
    mediaId: number,
    seasonNumber: number,
    title: string,
    opts: RetryActionOptions = {},
  ): Promise<ActionLog> {
    // Narrow to SonarrClient — triggerSeasonSearch is series-specific.
    const { instance, client } = await this.withClient(instanceId, "sonarr");

    return this.executeAction({
      instanceName: instance.name,
      instanceId,
      action: "search_season",
      mediaId,
      title,
      actionLogId: opts.actionLogId,
      groupId: opts.groupId,
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
    // Narrow to SonarrClient — getEpisodes + triggerEpisodeSearch are
    // series-specific.
    const { instance, client } = await this.withClient(instanceId, "sonarr");

    return this.executeAction({
      instanceName: instance.name,
      instanceId,
      action: "search_episode",
      mediaId,
      title,
      actionLogId: opts.actionLogId,
      groupId: opts.groupId,
      payload: { instanceId, action: "search_episode", mediaId, fileId, title },
      run: async () => {
        const episodes = await client.getEpisodes(mediaId);
        const episodeIds = episodes
          .filter((e) => e.episodeFileId === fileId)
          .map((e) => e.id);
        if (episodeIds.length === 0)
          throw new Error("Episode not found for file");
        return client.triggerEpisodeSearch(episodeIds);
      },
    });
  }
}

export const seriesService = new SeriesService();
