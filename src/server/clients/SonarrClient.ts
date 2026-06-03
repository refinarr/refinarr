import type { Instance } from "@/shared/types/models";
import type { ReleaseCandidate } from "@/shared/types/api";
import {
  ArrClient,
  mapReleaseCandidate,
  RELEASE_FETCH_TIMEOUT_MS,
  type UpstreamHistoryEvent,
  type UpstreamHistoryRecord,
  type UpstreamRelease,
} from "./ArrClient";

interface SonarrSeries {
  id: number;
  title: string;
  year: number;
  qualityProfileId: number;
  monitored: boolean;
  // Per-season episode + episode-file counts. Used to compute the
  // total / existing file counts for SeriesItem without a second API
  // call. Sonarr returns this on every series payload.
  seasons?: Array<{
    seasonNumber: number;
    monitored: boolean;
    statistics?: {
      episodeCount: number;
      episodeFileCount: number;
    };
  }>;
}

export interface SonarrEpisodeFile {
  id: number;
  seriesId: number;
  seasonNumber: number;
  relativePath: string;
  size?: number;
  customFormats?: Array<{ id: number; name: string }>;
  customFormatScore?: number;
}

interface SonarrQualityProfile {
  id: number;
  name: string;
  minUpgradeFormatScore: number;
  cutoffFormatScore: number;
  formatItems: Array<{ format: number; name: string; score: number }>;
}

const BATCH = 20;

export class SonarrClient extends ArrClient {
  protected readonly expectedAppName = "Sonarr";

  constructor(instance: Instance) {
    super(instance);
  }

  async getSeries(): Promise<SonarrSeries[]> {
    return this.fetch<SonarrSeries[]>("/series");
  }

  async getEpisodeFiles(seriesId: number): Promise<SonarrEpisodeFile[]> {
    return this.fetch<SonarrEpisodeFile[]>(`/episodefile?seriesId=${seriesId}`);
  }

  async getAllEpisodeFiles(
    seriesIds: number[],
  ): Promise<Map<number, SonarrEpisodeFile[]>> {
    const map = new Map<number, SonarrEpisodeFile[]>();
    for (let i = 0; i < seriesIds.length; i += BATCH) {
      const batch = seriesIds.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map((id) => this.getEpisodeFiles(id)),
      );
      batch.forEach((id, idx) => map.set(id, results[idx] ?? []));
    }
    return map;
  }

  async triggerSearch(seriesId: number): Promise<{ commandId: number }> {
    const res = await this.fetch<{ id: number }>("/command", {
      method: "POST",
      body: JSON.stringify({ name: "SeriesSearch", seriesId }),
    });
    return { commandId: res.id };
  }

  async triggerSeasonSearch(
    seriesId: number,
    seasonNumber: number,
  ): Promise<{ commandId: number }> {
    const res = await this.fetch<{ id: number }>("/command", {
      method: "POST",
      body: JSON.stringify({ name: "SeasonSearch", seriesId, seasonNumber }),
    });
    return { commandId: res.id };
  }

  async triggerEpisodeSearch(
    episodeIds: number[],
  ): Promise<{ commandId: number }> {
    const res = await this.fetch<{ id: number }>("/command", {
      method: "POST",
      body: JSON.stringify({ name: "EpisodeSearch", episodeIds }),
    });
    return { commandId: res.id };
  }

  // Interactive season-pack search — live indexer query, longer timeout.
  async getSeasonReleases(
    seriesId: number,
    seasonNumber: number,
  ): Promise<ReleaseCandidate[]> {
    const raw = await this.fetch<UpstreamRelease[]>(
      `/release?seriesId=${seriesId}&seasonNumber=${seasonNumber}`,
      undefined,
      RELEASE_FETCH_TIMEOUT_MS,
    );
    return (raw ?? []).map(mapReleaseCandidate);
  }

  // Force-grab a release the *arr re-resolves from its decision cache by
  // guid + indexerId. No command id is returned (the row is marked
  // "grabbed" directly).
  async grabRelease(opts: { guid: string; indexerId: number }): Promise<void> {
    await this.fetch("/release", {
      method: "POST",
      body: JSON.stringify({ guid: opts.guid, indexerId: opts.indexerId }),
    });
  }

  async getEpisodes(seriesId: number): Promise<
    Array<{
      id: number;
      episodeFileId: number;
      seasonNumber: number;
      episodeNumber: number;
    }>
  > {
    return this.fetch(`/episode?seriesId=${seriesId}`);
  }

  async deleteEpisodeFile(fileId: number): Promise<void> {
    await this.fetch(`/episodefile/${fileId}`, { method: "DELETE" });
  }

  // Implements ArrClient.deleteFile. Sonarr calls these "episode files"
  // upstream; we keep the original method name available too so the
  // existing series-specific call sites read naturally.
  async deleteFile(fileId: number): Promise<void> {
    return this.deleteEpisodeFile(fileId);
  }

  async getQualityProfiles(): Promise<SonarrQualityProfile[]> {
    return this.fetch<SonarrQualityProfile[]>("/qualityprofile");
  }

  // Per-arr projection — Sonarr history records carry both `episodeId`
  // and `seriesId`, so one record fans out to BOTH an episode-scoped and a
  // series-scoped event (an episode lifecycle event is also a series
  // lifecycle event). The episode event correlates per-episode search rows;
  // the series event lets series-level rows correlate to the same
  // grab/import/fail — specifically a season force-grab, which lands at
  // "grabbed" with mediaId=seriesId and would otherwise NEVER advance past
  // "grabbed" because Sonarr only reports lifecycle events at episode
  // granularity (#111). The service-side correlator still picks the right
  // row by (instanceId, mediaId, action), so the two scopes address
  // disjoint row sets and can't cross-update.
  protected projectHistoryRecord(
    r: UpstreamHistoryRecord,
  ): Array<{ mediaId: number; scope: UpstreamHistoryEvent["scope"] }> {
    const tags: Array<{
      mediaId: number;
      scope: UpstreamHistoryEvent["scope"];
    }> = [];
    if (typeof r.episodeId === "number" && r.episodeId > 0) {
      tags.push({ mediaId: r.episodeId, scope: "episode" });
    }
    if (typeof r.seriesId === "number" && r.seriesId > 0) {
      tags.push({ mediaId: r.seriesId, scope: "series" });
    }
    return tags;
  }
}
