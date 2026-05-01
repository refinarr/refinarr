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

const BATCH = 10;

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

  async getAllEpisodeFiles(seriesIds: number[]): Promise<Map<number, SonarrEpisodeFile[]>> {
    const map = new Map<number, SonarrEpisodeFile[]>();
    for (let i = 0; i < seriesIds.length; i += BATCH) {
      const batch = seriesIds.slice(i, i + BATCH);
      const results = await Promise.all(batch.map((id) => this.getEpisodeFiles(id)));
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

  async deleteEpisodeFile(fileId: number): Promise<void> {
    await this.fetch(`/episodefile/${fileId}`, { method: "DELETE" });
  }

  async getQualityProfiles(): Promise<SonarrQualityProfile[]> {
    return this.fetch<SonarrQualityProfile[]>("/qualityprofile");
  }
}
