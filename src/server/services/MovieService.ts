import type { FlaggedMovie, ActionLog, ScoringMode } from "@/shared/types/models";
import { MediaService } from "./MediaService";
import { instanceRepository } from "@/server/repositories/InstanceRepository";
import { preferenceRepository } from "@/server/repositories/PreferenceRepository";
import { ignoreRepository } from "@/server/repositories/IgnoreRepository";
import { configRepository } from "@/server/repositories/ConfigRepository";
import { ArrClientFactory } from "@/server/clients/ArrClientFactory";
import { RadarrClient } from "@/server/clients/RadarrClient";
import { dataCache, CACHE_TTL_MS } from "@/server/lib/DataCache";
import { appLogger } from "@/server/lib/app-logger";
import {
  isMissingWantedFormats,
  getMissingFormats,
  scoreCfCoverage,
  isBelowProfileScore,
  scoreProfileCoverage,
} from "@/server/lib/scoring";

interface MovieQuery {
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

export class MovieService extends MediaService {
  async getFlaggedMovies(
    instanceId: number,
    query: MovieQuery
  ): Promise<{ items: FlaggedMovie[]; total: number }> {
    const instance = await instanceRepository.findById(instanceId);
    if (!instance) throw new Error(`Instance ${instanceId} not found`);

    const scoringMode = await configRepository.get(`scoringMode:${instanceId}`);
    const mode = (scoringMode ?? "manual") as ScoringMode;

    const cacheKey = `movies:${instanceId}:${mode}`;
    let cached = dataCache.get<{ flagged: FlaggedMovie[] }>(cacheKey, CACHE_TTL_MS);

    if (cached) {
      appLogger.debug("Cache hit", { source: "movie-service", context: { cacheKey } });
    } else {
      const startedAt = Date.now();
      const flagged = await this.buildFlaggedMovies(instanceId, instance, mode);
      cached = { flagged };
      dataCache.set(cacheKey, cached);
      appLogger.info("Built flagged movies cache", {
        source: "movie-service",
        context: {
          instanceId,
          instanceName: instance.name,
          mode,
          flagged: flagged.length,
          durationMs: Date.now() - startedAt,
        },
      });
    }

    return this.applyQuery(cached.flagged, query, mode);
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

    if (mode === "profile") {
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

  private applyQuery(
    source: FlaggedMovie[],
    query: MovieQuery,
    mode: ScoringMode
  ): { items: FlaggedMovie[]; total: number } {
    let flagged = source;

    if (query.maxScore !== undefined) {
      flagged = flagged.filter((m) => m.cfScore <= query.maxScore!);
    }

    if (query.q) {
      const q = query.q.toLowerCase();
      flagged = flagged.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.missingFormats.some((cf) => cf.name.toLowerCase().includes(q))
      );
    }

    if (query.profileId !== undefined) {
      flagged = flagged.filter((m) => m.qualityProfileId === query.profileId);
    }

    if (query.missingCfId !== undefined) {
      flagged = flagged.filter((m) => m.missingFormats.some((cf) => cf.id === query.missingCfId));
    }

    if (query.hasNegativeCfId !== undefined) {
      flagged = flagged.filter((m) => m.unwantedFormats.some((cf) => cf.id === query.hasNegativeCfId));
    }

    const sorted = [...flagged].sort((a, b) => {
      const dir = query.order === "asc" ? 1 : -1;
      if (query.sortBy === "score" || query.sortBy === "size") {
        if (!a.hasFile && !b.hasFile) return 0;
        if (!a.hasFile) return 1;
        if (!b.hasFile) return -1;
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

    const total = sorted.length;
    const start = (query.page - 1) * query.limit;
    return { items: sorted.slice(start, start + query.limit), total };
  }

  async triggerSearch(instanceId: number, mediaId: number, title: string): Promise<ActionLog> {
    const instance = await instanceRepository.findById(instanceId);
    if (!instance) throw new Error(`Instance ${instanceId} not found`);
    const client = ArrClientFactory.createArrClient(instance) as RadarrClient;

    return this.executeAction({
      instanceName: instance.name,
      instanceId,
      action: "search",
      mediaId,
      title,
      payload: { instanceId, action: "search", mediaId, title },
      run: () => client.triggerSearch(mediaId),
    });
  }

  async deleteFile(
    instanceId: number,
    mediaId: number,
    fileId: number,
    title: string,
    triggerSearch = true
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
      payload: { instanceId, action: "delete_blacklist", mediaId, fileId, title, triggerSearch },
      run: async () => {
        await client.deleteFile(fileId);
        if (triggerSearch) await client.triggerSearch(mediaId);
      },
    });
  }
}

export const movieService = new MovieService();
