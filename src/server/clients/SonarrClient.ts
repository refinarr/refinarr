import type { Instance } from "@/shared/types/models";
import { ArrClient } from "./ArrClient";

interface SonarrSeries {
  id: number;
  title: string;
  year: number;
  qualityProfileId: number;
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

  async triggerSearch(seriesId: number): Promise<void> {
    await this.fetch("/command", {
      method: "POST",
      body: JSON.stringify({ name: "SeriesSearch", seriesId }),
    });
  }

  async triggerSeasonSearch(
    seriesId: number,
    seasonNumber: number,
  ): Promise<void> {
    await this.fetch("/command", {
      method: "POST",
      body: JSON.stringify({ name: "SeasonSearch", seriesId, seasonNumber }),
    });
  }

  async triggerEpisodeSearch(episodeIds: number[]): Promise<void> {
    await this.fetch("/command", {
      method: "POST",
      body: JSON.stringify({ name: "EpisodeSearch", episodeIds }),
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

  async getQualityProfiles(): Promise<SonarrQualityProfile[]> {
    return this.fetch<SonarrQualityProfile[]>("/qualityprofile");
  }
}
