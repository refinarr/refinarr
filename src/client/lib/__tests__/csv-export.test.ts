// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { exportMoviesCsv, exportSeriesCsv } from "@/client/lib/csv-export";
import type { MovieItem, SeriesItem } from "@/shared/types/models";

const blobs: Blob[] = [];
const clicks: HTMLAnchorElement[] = [];
let revoked: string[] = [];

beforeEach(() => {
  blobs.length = 0;
  clicks.length = 0;
  revoked = [];
  vi.stubGlobal("URL", {
    createObjectURL: (b: Blob) => {
      blobs.push(b);
      return `blob:${blobs.length}`;
    },
    revokeObjectURL: (u: string) => {
      revoked.push(u);
    },
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicks.push(this);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function blobToText(b: Blob): Promise<string> {
  return new Response(b).text();
}

const movie: MovieItem = {
  id: 1,
  title: "Movie A",
  year: 2024,
  qualityProfileId: 1,
  movieFileId: 10,
  customFormats: [],
  customFormatScore: 0,
  hasFile: true,
  cfScore: 0.5,
  missingFormats: [
    { id: 1, name: "HDR" },
    { id: 2, name: "DV" },
  ],
  unwantedFormats: [],
  sizeOnDisk: 1024,
  monitored: true,
  existingFileCount: 1,
  totalFileCount: 1,
  flagged: true,
};

const series: SeriesItem = {
  id: 11,
  title: "Show A",
  year: 2023,
  qualityProfileId: 1,
  customFormats: [],
  customFormatScore: 0,
  cfScore: 0.75,
  missingFormats: [{ id: 99, name: "Atmos" }],
  unwantedFormats: [],
  sizeOnDisk: 5_000_000_000,
  monitored: true,
  existingFileCount: 12,
  totalFileCount: 12,
  flagged: true,
  affectedEpisodeCount: 0,
  totalEpisodeCount: 12,
  episodeFiles: [],
};

describe("exportMoviesCsv", () => {
  test("creates a CSV with title/year/score/missing/hasFile columns and triggers download", async () => {
    exportMoviesCsv([movie], "out.csv");
    expect(clicks).toHaveLength(1);
    expect(clicks[0].download).toBe("out.csv");
    expect(blobs).toHaveLength(1);
    const text = await blobToText(blobs[0]);
    expect(text).toContain("Title,Year,Score,MissingFormats,HasFile");
    expect(text).toContain('Movie A,2024,50%,"HDR, DV",Yes');
  });

  test("uses the default filename when none is provided", () => {
    exportMoviesCsv([movie]);
    expect(clicks[0].download).toBe("movies.csv");
  });

  test("revokes the object URL after triggering the download", () => {
    exportMoviesCsv([movie]);
    expect(revoked).toEqual(["blob:1"]);
  });

  test("renders HasFile=No when the movie has no file", async () => {
    exportMoviesCsv([{ ...movie, hasFile: false }]);
    const text = await blobToText(blobs[0]);
    expect(text).toContain(",No");
  });
});

describe("exportSeriesCsv", () => {
  test("creates a CSV with the series shape", async () => {
    exportSeriesCsv([series], "shows.csv");
    expect(clicks[0].download).toBe("shows.csv");
    const text = await blobToText(blobs[0]);
    expect(text).toContain("Title,Year,Score,MissingFormats");
    expect(text).toContain("Show A,2023,75%,Atmos");
  });

  test("uses the default series.csv filename", () => {
    exportSeriesCsv([series]);
    expect(clicks[0].download).toBe("series.csv");
  });
});
