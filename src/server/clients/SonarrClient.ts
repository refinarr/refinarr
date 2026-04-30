import type { Instance } from "@/shared/types/models";
import { ArrClient } from "./ArrClient";

interface SonarrSeries {
  id: number;
  title: string;
  year: number;
  qualityProfileId: number;
  customFormats: Array<{ id: number; name: string }>;
  customFormatScore: number;
}

interface SonarrQualityProfile {
  id: number;
  name: string;
  minUpgradeFormatScore: number;
}

export class SonarrClient extends ArrClient {
  constructor(instance: Instance) {
    super(instance);
  }

  async getSeries(): Promise<SonarrSeries[]> {
    return this.fetch<SonarrSeries[]>("/series");
  }

  async triggerSearch(seriesId: number): Promise<void> {
    await this.fetch("/command", {
      method: "POST",
      body: JSON.stringify({ name: "SeriesSearch", seriesId }),
    });
  }

  async getEpisodeFiles(seriesId: number): Promise<Array<{ id: number }>> {
    return this.fetch<Array<{ id: number }>>(`/episodefile?seriesId=${seriesId}`);
  }

  async deleteEpisodeFile(fileId: number): Promise<void> {
    await this.fetch(`/episodefile/${fileId}`, { method: "DELETE" });
  }

  async getQualityProfiles(): Promise<SonarrQualityProfile[]> {
    return this.fetch<SonarrQualityProfile[]>("/qualityprofile");
  }
}
