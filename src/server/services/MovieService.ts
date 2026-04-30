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
}

export class MovieService extends MediaService {
  async getFlaggedMovies(
    instanceId: number,
    query: MovieQuery
  ): Promise<{ items: FlaggedMovie[]; total: number }> {
    const instance = await instanceRepository.findById(instanceId);
    if (!instance) throw new Error(`Instance ${instanceId} not found`);

    const client = ArrClientFactory.createArrClient(instance) as RadarrClient;
    const [movies, scoringMode] = await Promise.all([
      client.getMovies(),
      configRepository.get(`scoringMode:${instanceId}`),
    ]);

    const mode = scoringMode ?? "manual";
    const ignoredSet = new Set(
      (await ignoreRepository.findByInstance(instanceId))
        .filter((e) => e.mediaType === "movie")
        .map((e) => e.mediaId)
    );

    let flagged: FlaggedMovie[];

    if (mode === "profile") {
      const profiles = await client.getQualityProfiles();
      const profileMap = new Map(profiles.map((p) => [p.id, p]));
      flagged = movies
        .filter((m) => !ignoredSet.has(m.id))
        .filter((m) => {
          const profile = profileMap.get(m.qualityProfileId);
          if (!profile) return false;
          return isBelowProfileScore(m.customFormatScore, profile.minUpgradeFormatScore);
        })
        .map((m) => {
          const profile = profileMap.get(m.qualityProfileId)!;
          return {
            id: m.id,
            title: m.title,
            year: m.year,
            qualityProfileId: m.qualityProfileId,
            customFormats: m.customFormats,
            customFormatScore: m.customFormatScore,
            hasFile: m.hasFile,
            cfScore: scoreProfileCoverage(m.customFormatScore, profile.minUpgradeFormatScore),
            missingFormats: [],
            scoreDelta: profile.minUpgradeFormatScore - m.customFormatScore,
          };
        });
    } else {
      const prefs = await preferenceRepository.findByInstance(instanceId);
      if (prefs.length === 0) return { items: [], total: 0 };

      const wantedIds = prefs.map((p) => p.cfId);
      const wantedCfs = prefs.map((p) => ({ id: p.cfId, name: p.cfName }));

      flagged = movies
        .filter((m) => !ignoredSet.has(m.id))
        .filter((m) => !m.hasFile || isMissingWantedFormats(m.customFormats, wantedIds))
        .map((m) => ({
          id: m.id,
          title: m.title,
          year: m.year,
          qualityProfileId: m.qualityProfileId,
          customFormats: m.customFormats,
          customFormatScore: m.customFormatScore,
          hasFile: m.hasFile,
          cfScore: m.hasFile ? scoreCfCoverage(m.customFormats, wantedIds) : 0,
          missingFormats: getMissingFormats(m.customFormats, wantedCfs),
        }));
    }

    if (query.maxScore !== undefined) {
      flagged = flagged.filter((m) => m.cfScore <= query.maxScore!);
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

  async deleteAndBlacklist(
    instanceId: number,
    mediaId: number,
    fileId: number,
    title: string
  ): Promise<ActionLog> {
    const instance = await instanceRepository.findById(instanceId);
    if (!instance) throw new Error(`Instance ${instanceId} not found`);
    const client = ArrClientFactory.createArrClient(instance) as RadarrClient;

    return this.executeAction({
      instanceId,
      action: "delete_blacklist",
      mediaId,
      title,
      payload: { instanceId, action: "delete_blacklist", mediaId, fileId, title },
      run: async () => {
        await client.deleteFile(fileId);
        await client.blacklist(mediaId);
      },
    });
  }
}

export const movieService = new MovieService();
