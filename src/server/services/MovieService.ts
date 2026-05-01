import type { FlaggedMovie, ActionLog } from "@/shared/types/models";
import { MediaService } from "./MediaService";
import { instanceRepository } from "@/server/repositories/InstanceRepository";
import { preferenceRepository } from "@/server/repositories/PreferenceRepository";
import { ignoreRepository } from "@/server/repositories/IgnoreRepository";
import { configRepository } from "@/server/repositories/ConfigRepository";
import { ArrClientFactory } from "@/server/clients/ArrClientFactory";
import { RadarrClient } from "@/server/clients/RadarrClient";
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
  sortBy: "score" | "title" | "added";
  order: "asc" | "desc";
  maxScore?: number;
  q?: string;
  profileId?: number;
  missingCfId?: number;
}

export class MovieService extends MediaService {
  async getFlaggedMovies(
    instanceId: number,
    query: MovieQuery
  ): Promise<{ items: FlaggedMovie[]; total: number }> {
    const instance = await instanceRepository.findById(instanceId);
    if (!instance) throw new Error(`Instance ${instanceId} not found`);

    const client = ArrClientFactory.createArrClient(instance) as RadarrClient;
    const [movies, profiles, scoringMode] = await Promise.all([
      client.getMovies(),
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

    const fileIds = movies.filter((m) => m.hasFile && m.movieFileId > 0).map((m) => m.movieFileId);
    const movieFiles = await client.getMovieFilesByIds(fileIds);
    const fileMap = new Map(movieFiles.map((f) => [f.movieId, f]));

    const mode = scoringMode ?? "manual";
    const ignoredSet = new Set(
      (await ignoreRepository.findByInstance(instanceId))
        .filter((e) => e.mediaType === "movie")
        .map((e) => e.mediaId)
    );

    let flagged: FlaggedMovie[];

    if (mode === "profile") {
      flagged = movies
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
          return {
            id: m.id,
            title: m.title,
            year: m.year,
            qualityProfileId: m.qualityProfileId,
            movieFileId: m.movieFileId,
            customFormats: file?.customFormats?.map(cf => ({ id: cf.id, name: cf.name, score: cfScores.get(cf.id) })) ?? [],
            customFormatScore: score,
            hasFile: m.hasFile,
            cfScore: scoreProfileCoverage(score, profile.cutoffFormatScore),
            missingFormats: [],
            minProfileScore: profile.cutoffFormatScore,
          };
        });
    } else {
      const prefs = await preferenceRepository.findByInstance(instanceId);
      if (prefs.length === 0) return { items: [], total: 0 };

      const wantedIds = prefs.map((p) => p.cfId);
      const wantedCfs = prefs.map((p) => ({ id: p.cfId, name: p.cfName }));

      flagged = movies
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
          };
        });
    }

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
    const client = ArrClientFactory.createArrClient(instance) as RadarrClient;

    return this.executeAction({
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
