import type { Instance } from "@/shared/types/models";
import {
  ArrClient,
  type UpstreamHistoryEvent,
  type UpstreamHistoryRecord,
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
  // and `seriesId`. We tag each record at the granularity that matches
  // how refinarr triggered the search:
  //   - episodeId > 0 → scope="episode" (triggerEpisodeFileSearch)
  //   - else          → scope="series"  (triggerSearch / Season)
  // The service-side correlator picks the right ActionLog row by
  // (instanceId, mediaId, action) so the scope tag prevents an episode
  // event from updating a series-level action row by accident.
  protected projectHistoryRecord(
    r: UpstreamHistoryRecord,
  ): { mediaId: number; scope: UpstreamHistoryEvent["scope"] } | null {
    if (typeof r.episodeId === "number" && r.episodeId > 0) {
      return { mediaId: r.episodeId, scope: "episode" };
    }
    if (typeof r.seriesId === "number" && r.seriesId > 0) {
      return { mediaId: r.seriesId, scope: "series" };
    }
    return null;
  }
}
