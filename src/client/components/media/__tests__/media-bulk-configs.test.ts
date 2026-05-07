import { describe, it, expect } from "vitest";
import type { MovieItem, SeriesItem } from "@/shared/types/models";
import { MOVIE_BULK_CONFIG, SERIES_BULK_CONFIG } from "../media-bulk-configs";

const baseMovie: MovieItem = {
  id: 7,
  title: "Test Movie",
  year: 2024,
  qualityProfileId: 1,
  movieFileId: 42,
  customFormats: [],
  customFormatScore: 0,
  hasFile: true,
  cfScore: 0.5,
  missingFormats: [],
  unwantedFormats: [],
  sizeOnDisk: 0,
  monitored: true,
  existingFileCount: 1,
  totalFileCount: 1,
  flagged: true,
};

const baseSeries: SeriesItem = {
  id: 9,
  title: "Test Series",
  year: 2024,
  qualityProfileId: 1,
  customFormats: [],
  customFormatScore: 0,
  cfScore: 0.5,
  missingFormats: [],
  unwantedFormats: [],
  affectedEpisodeCount: 1,
  totalEpisodeCount: 5,
  episodeFiles: [
    {
      id: 100,
      seasonNumber: 1,
      relativePath: "S01E01.mkv",
      customFormats: [],
      customFormatScore: 0,
      missingFormats: [],
      unwantedFormats: [],
      size: 0,
    },
    {
      id: 101,
      seasonNumber: 1,
      relativePath: "S01E02.mkv",
      customFormats: [],
      customFormatScore: 0,
      missingFormats: [],
      unwantedFormats: [],
      size: 0,
    },
  ],
  sizeOnDisk: 0,
  monitored: true,
  existingFileCount: 2,
  totalFileCount: 5,
  flagged: true,
};

describe("MOVIE_BULK_CONFIG", () => {
  it("exposes the movie endpoints + mediaType", () => {
    expect(MOVIE_BULK_CONFIG.mediaType).toBe("movie");
    expect(MOVIE_BULK_CONFIG.search.endpoint).toBe("/radarr/movies/search");
    expect(MOVIE_BULK_CONFIG.delete.endpoint).toBe("/radarr/movies/delete");
    expect(MOVIE_BULK_CONFIG.ignore.endpoint).toBe("/ignore");
  });

  it("delete.body includes fileId from movieFileId", () => {
    const body = MOVIE_BULK_CONFIG.delete.body(baseMovie, 1, true);
    expect(body).toMatchObject({
      instanceId: 1,
      mediaId: 7,
      title: "Test Movie",
      search: true,
      fileId: 42,
    });
  });

  it("isDeletable returns false when movie has no file", () => {
    expect(
      MOVIE_BULK_CONFIG.delete.isDeletable!({ ...baseMovie, hasFile: false }),
    ).toBe(false);
    expect(
      MOVIE_BULK_CONFIG.delete.isDeletable!({ ...baseMovie, movieFileId: 0 }),
    ).toBe(false);
    expect(MOVIE_BULK_CONFIG.delete.isDeletable!(baseMovie)).toBe(true);
  });

  it("ignore.body carries mediaType=movie", () => {
    expect(MOVIE_BULK_CONFIG.ignore.body(baseMovie, 1)).toMatchObject({
      mediaType: "movie",
    });
  });
});

describe("SERIES_BULK_CONFIG", () => {
  it("exposes the series endpoints + mediaType", () => {
    expect(SERIES_BULK_CONFIG.mediaType).toBe("series");
    expect(SERIES_BULK_CONFIG.search.endpoint).toBe("/sonarr/series/search");
    expect(SERIES_BULK_CONFIG.delete.endpoint).toBe("/sonarr/series/delete");
    expect(SERIES_BULK_CONFIG.ignore.endpoint).toBe("/ignore");
  });

  it("delete.body includes fileIds derived from episodeFiles", () => {
    const body = SERIES_BULK_CONFIG.delete.body(baseSeries, 2, false);
    expect(body).toMatchObject({
      instanceId: 2,
      mediaId: 9,
      title: "Test Series",
      search: false,
      fileIds: [100, 101],
    });
  });

  it("isDeletable returns false when series has no episode files", () => {
    expect(
      SERIES_BULK_CONFIG.delete.isDeletable!({
        ...baseSeries,
        episodeFiles: [],
      }),
    ).toBe(false);
    expect(SERIES_BULK_CONFIG.delete.isDeletable!(baseSeries)).toBe(true);
  });

  it("ignore.body carries mediaType=series", () => {
    expect(SERIES_BULK_CONFIG.ignore.body(baseSeries, 2)).toMatchObject({
      mediaType: "series",
    });
  });
});
