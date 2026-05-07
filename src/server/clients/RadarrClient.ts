import type { Instance } from "@/shared/types/models";
import { ArrClient } from "./ArrClient";

interface RadarrMovie {
  id: number;
  title: string;
  year: number;
  qualityProfileId: number;
  hasFile: boolean;
  movieFileId: number;
  // monitored is part of every Radarr movie payload — surface it so the
  // MediaItem output can carry it without a second API call.
  monitored: boolean;
}

export interface RadarrMovieFile {
  id: number;
  movieId: number;
  size?: number;
  customFormats?: Array<{ id: number; name: string }>;
  customFormatScore?: number;
}

interface RadarrQualityProfile {
  id: number;
  name: string;
  minUpgradeFormatScore: number;
  cutoffFormatScore: number;
  formatItems: Array<{ format: number; name: string; score: number }>;
}

const CHUNK = 200;

export class RadarrClient extends ArrClient {
  constructor(instance: Instance) {
    super(instance);
  }

  async getMovies(): Promise<RadarrMovie[]> {
    return this.fetch<RadarrMovie[]>("/movie");
  }

  async getMovieFilesByIds(fileIds: number[]): Promise<RadarrMovieFile[]> {
    if (fileIds.length === 0) return [];
    const chunks: number[][] = [];
    for (let i = 0; i < fileIds.length; i += CHUNK) {
      chunks.push(fileIds.slice(i, i + CHUNK));
    }
    const results = await Promise.all(
      chunks.map((chunk) => {
        const qs = chunk.map((id) => `movieFileIds=${id}`).join("&");
        return this.fetch<RadarrMovieFile[]>(`/moviefile?${qs}`);
      }),
    );
    return results.flat();
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

  async getQualityProfiles(): Promise<RadarrQualityProfile[]> {
    return this.fetch<RadarrQualityProfile[]>("/qualityprofile");
  }
}
