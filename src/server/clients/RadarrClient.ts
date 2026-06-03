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
  protected readonly expectedAppName = "Radarr";

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

  async triggerSearch(movieId: number): Promise<{ commandId: number }> {
    const res = await this.fetch<{ id: number }>("/command", {
      method: "POST",
      body: JSON.stringify({ name: "MoviesSearch", movieIds: [movieId] }),
    });
    return { commandId: res.id };
  }

  async deleteFile(fileId: number): Promise<void> {
    await this.fetch(`/moviefile/${fileId}`, { method: "DELETE" });
  }

  // Interactive search — live indexer query, so it gets the longer
  // RELEASE_FETCH_TIMEOUT_MS ceiling instead of the default 10s.
  async getReleases(movieId: number): Promise<ReleaseCandidate[]> {
    const raw = await this.fetch<UpstreamRelease[]>(
      `/release?movieId=${movieId}`,
      undefined,
      RELEASE_FETCH_TIMEOUT_MS,
    );
    return (raw ?? []).map(mapReleaseCandidate);
  }

  // Force-grab a specific release. POST /release re-resolves the release
  // from the *arr's own decision cache by guid + indexerId and hands it to
  // the download client, bypassing the auto-upgrade gate. Returns no
  // command id (unlike /command searches), so the caller marks the row
  // "grabbed" directly.
  async grabRelease(opts: {
    guid: string;
    indexerId: number;
    movieId: number;
  }): Promise<void> {
    await this.fetch("/release", {
      method: "POST",
      body: JSON.stringify({
        guid: opts.guid,
        indexerId: opts.indexerId,
        movieId: opts.movieId,
      }),
    });
  }

  async getQualityProfiles(): Promise<RadarrQualityProfile[]> {
    return this.fetch<RadarrQualityProfile[]>("/qualityprofile");
  }

  // Per-arr projection — Radarr history records carry `movieId` as the
  // sole id field. ArrClient owns the fetch + filter loop.
  protected projectHistoryRecord(
    r: UpstreamHistoryRecord,
  ): { mediaId: number; scope: UpstreamHistoryEvent["scope"] } | null {
    if (typeof r.movieId !== "number") return null;
    return { mediaId: r.movieId, scope: "movie" };
  }
}
