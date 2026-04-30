import type { Instance } from "@/shared/types/models";
import { ArrClient } from "./ArrClient";

interface RadarrMovie {
  id: number;
  title: string;
  year: number;
  qualityProfileId: number;
  hasFile: boolean;
  customFormats: Array<{ id: number; name: string }>;
  customFormatScore: number;
  movieFile?: { id: number };
}

interface RadarrQualityProfile {
  id: number;
  name: string;
  minUpgradeFormatScore: number;
}

export class RadarrClient extends ArrClient {
  constructor(instance: Instance) {
    super(instance);
  }

  async getMovies(): Promise<RadarrMovie[]> {
    return this.fetch<RadarrMovie[]>("/movie");
  }

  async triggerSearch(movieId: number): Promise<void> {
    await this.fetch("/command", {
      method: "POST",
      body: JSON.stringify({ name: "MoviesSearch", movieIds: [movieId] }),
    });
  }

  async deleteFile(fileId: number): Promise<void> {
    await this.fetch(`/moviefile/${fileId}`, { method: "DELETE" });
  }

  async blacklist(movieId: number): Promise<void> {
    await this.fetch(`/blacklist`, {
      method: "POST",
      body: JSON.stringify({ movieId }),
    });
  }

  async getQualityProfiles(): Promise<RadarrQualityProfile[]> {
    return this.fetch<RadarrQualityProfile[]>("/qualityprofile");
  }
}
