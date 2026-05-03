import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { movieService } from "@/server/services/MovieService";
import { instanceService } from "@/server/services/InstanceService";
import { preferenceRepository } from "@/server/repositories/PreferenceRepository";
import { ignoreRepository } from "@/server/repositories/IgnoreRepository";
import { configRepository } from "@/server/repositories/ConfigRepository";
import { logRepository } from "@/server/repositories/LogRepository";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

const baseInstance = {
  type: "radarr" as const,
  name: "Test Radarr",
  url: "http://192.168.1.10:7878",
  apiKey: "abcd1234abcd1234abcd1234abcd1234",
};

interface RadarrMovie {
  id: number;
  title: string;
  year: number;
  qualityProfileId: number;
  hasFile: boolean;
  movieFileId: number;
}

interface RadarrFile {
  id: number;
  movieId: number;
  size: number;
  customFormats: Array<{ id: number; name: string }>;
  customFormatScore: number;
}

interface RadarrProfile {
  id: number;
  name: string;
  minUpgradeFormatScore: number;
  cutoffFormatScore: number;
  formatItems: Array<{ format: number; name: string; score: number }>;
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function setupRadarrMocks(opts: {
  movies: RadarrMovie[];
  files: RadarrFile[];
  profiles: RadarrProfile[];
}) {
  fetchMock.mockImplementation(async (url: string) => {
    if (url.endsWith("/api/v3/movie")) return jsonResponse(opts.movies);
    if (url.includes("/api/v3/qualityprofile")) return jsonResponse(opts.profiles);
    if (url.includes("/api/v3/moviefile?")) {
      const ids = url.match(/movieFileIds=(\d+)/g)?.map((m) => Number(m.split("=")[1])) ?? [];
      const idSet = new Set(ids);
      return jsonResponse(opts.files.filter((f) => idSet.has(f.id)));
    }
    if (url.includes("/api/v3/command")) return jsonResponse({ id: 1 });
    if (url.includes("/api/v3/moviefile/")) return new Response("", { status: 200 });
    return new Response("not mocked", { status: 404 });
  });
}

const profile: RadarrProfile = {
  id: 1,
  name: "HD-1080p",
  minUpgradeFormatScore: 0,
  cutoffFormatScore: 100,
  formatItems: [
    { format: 10, name: "HDR", score: 50 },
    { format: 11, name: "Atmos", score: 30 },
    { format: 12, name: "x265", score: -10 },
  ],
};

describe("MovieService.getFlaggedMovies — manual mode", () => {
  test("returns empty when no preferences are configured", async () => {
    const instance = await instanceService.create(baseInstance);
    setupRadarrMocks({ movies: [], files: [], profiles: [] });
    const result = await movieService.getFlaggedMovies(instance.id, {
      page: 1, limit: 50, sortBy: "score", order: "asc",
    });
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  test("flags movies missing wanted CFs and excludes ones with all wanted", async () => {
    const instance = await instanceService.create(baseInstance);
    await preferenceRepository.setForInstance(instance.id, [
      { cfId: 10, cfName: "HDR" },
    ]);
    setupRadarrMocks({
      movies: [
        { id: 1, title: "A", year: 2024, qualityProfileId: 1, hasFile: true, movieFileId: 100 },
        { id: 2, title: "B", year: 2024, qualityProfileId: 1, hasFile: true, movieFileId: 200 },
      ],
      files: [
        { id: 100, movieId: 1, size: 1024, customFormats: [], customFormatScore: 0 },
        { id: 200, movieId: 2, size: 1024, customFormats: [{ id: 10, name: "HDR" }], customFormatScore: 50 },
      ],
      profiles: [profile],
    });
    const result = await movieService.getFlaggedMovies(instance.id, {
      page: 1, limit: 50, sortBy: "title", order: "asc",
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("A");
    expect(result.items[0].missingFormats.map((c) => c.name)).toEqual(["HDR"]);
  });

  test("flags movies that have no file at all", async () => {
    const instance = await instanceService.create(baseInstance);
    await preferenceRepository.setForInstance(instance.id, [{ cfId: 10, cfName: "HDR" }]);
    setupRadarrMocks({
      movies: [
        { id: 1, title: "Missing", year: 2024, qualityProfileId: 1, hasFile: false, movieFileId: 0 },
      ],
      files: [],
      profiles: [profile],
    });
    const result = await movieService.getFlaggedMovies(instance.id, {
      page: 1, limit: 50, sortBy: "score", order: "asc",
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].hasFile).toBe(false);
    expect(result.items[0].cfScore).toBe(0);
  });

  test("excludes ignored movies", async () => {
    const instance = await instanceService.create(baseInstance);
    await preferenceRepository.setForInstance(instance.id, [{ cfId: 10, cfName: "HDR" }]);
    await ignoreRepository.create({ instanceId: instance.id, mediaId: 1, mediaType: "movie", title: "A" });
    setupRadarrMocks({
      movies: [
        { id: 1, title: "A", year: 2024, qualityProfileId: 1, hasFile: true, movieFileId: 100 },
      ],
      files: [{ id: 100, movieId: 1, size: 1024, customFormats: [], customFormatScore: 0 }],
      profiles: [profile],
    });
    const result = await movieService.getFlaggedMovies(instance.id, {
      page: 1, limit: 50, sortBy: "score", order: "asc",
    });
    expect(result.items).toEqual([]);
  });
});

describe("MovieService.getFlaggedMovies — profile mode", () => {
  test("flags movies whose customFormatScore is below cutoffFormatScore", async () => {
    const instance = await instanceService.create(baseInstance);
    await configRepository.set(`scoringMode:${instance.id}`, "profile");
    setupRadarrMocks({
      movies: [
        { id: 1, title: "Low", year: 2024, qualityProfileId: 1, hasFile: true, movieFileId: 100 },
        { id: 2, title: "OK", year: 2024, qualityProfileId: 1, hasFile: true, movieFileId: 200 },
      ],
      files: [
        { id: 100, movieId: 1, size: 1024, customFormats: [], customFormatScore: 50 },
        { id: 200, movieId: 2, size: 1024, customFormats: [{ id: 10, name: "HDR" }], customFormatScore: 100 },
      ],
      profiles: [profile],
    });
    const result = await movieService.getFlaggedMovies(instance.id, {
      page: 1, limit: 50, sortBy: "score", order: "asc",
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("Low");
    expect(result.items[0].minProfileScore).toBe(100);
  });

  test("populates unwantedFormats from negative-scoring CFs in the file", async () => {
    const instance = await instanceService.create(baseInstance);
    await configRepository.set(`scoringMode:${instance.id}`, "profile");
    setupRadarrMocks({
      movies: [{ id: 1, title: "Bad", year: 2024, qualityProfileId: 1, hasFile: true, movieFileId: 100 }],
      files: [
        {
          id: 100, movieId: 1, size: 1024,
          customFormats: [{ id: 12, name: "x265" }],
          customFormatScore: -10,
        },
      ],
      profiles: [profile],
    });
    const result = await movieService.getFlaggedMovies(instance.id, {
      page: 1, limit: 50, sortBy: "score", order: "asc",
    });
    expect(result.items[0].unwantedFormats.map((c) => c.name)).toEqual(["x265"]);
  });
});

describe("MovieService.getFlaggedMovies — applyQuery", () => {
  beforeEach(async () => {
    const instance = await instanceService.create(baseInstance);
    await preferenceRepository.setForInstance(instance.id, [{ cfId: 10, cfName: "HDR" }]);
    setupRadarrMocks({
      movies: [
        { id: 1, title: "Alpha", year: 2024, qualityProfileId: 1, hasFile: true, movieFileId: 1 },
        { id: 2, title: "Bravo", year: 2024, qualityProfileId: 1, hasFile: true, movieFileId: 2 },
        { id: 3, title: "Charlie", year: 2024, qualityProfileId: 1, hasFile: true, movieFileId: 3 },
      ],
      files: [
        { id: 1, movieId: 1, size: 100, customFormats: [], customFormatScore: 0 },
        { id: 2, movieId: 2, size: 200, customFormats: [], customFormatScore: 0 },
        { id: 3, movieId: 3, size: 300, customFormats: [], customFormatScore: 0 },
      ],
      profiles: [profile],
    });
  });

  test("paginates results", async () => {
    const inst = (await instanceService.getAll())[0];
    const page1 = await movieService.getFlaggedMovies(inst.id, {
      page: 1, limit: 2, sortBy: "title", order: "asc",
    });
    expect(page1.items).toHaveLength(2);
    expect(page1.total).toBe(3);
    const page2 = await movieService.getFlaggedMovies(inst.id, {
      page: 2, limit: 2, sortBy: "title", order: "asc",
    });
    expect(page2.items).toHaveLength(1);
  });

  test("filters by query string against title", async () => {
    const inst = (await instanceService.getAll())[0];
    const result = await movieService.getFlaggedMovies(inst.id, {
      page: 1, limit: 50, sortBy: "title", order: "asc", q: "alpha",
    });
    expect(result.items.map((m) => m.title)).toEqual(["Alpha"]);
  });

  test("filters by query string against missingFormats names", async () => {
    const inst = (await instanceService.getAll())[0];
    const result = await movieService.getFlaggedMovies(inst.id, {
      page: 1, limit: 50, sortBy: "title", order: "asc", q: "hdr",
    });
    expect(result.items.length).toBeGreaterThan(0);
  });

  test("sorts by size descending", async () => {
    const inst = (await instanceService.getAll())[0];
    const result = await movieService.getFlaggedMovies(inst.id, {
      page: 1, limit: 50, sortBy: "size", order: "desc",
    });
    expect(result.items.map((m) => m.title)).toEqual(["Charlie", "Bravo", "Alpha"]);
  });

  test("filters by maxScore", async () => {
    const inst = (await instanceService.getAll())[0];
    const result = await movieService.getFlaggedMovies(inst.id, {
      page: 1, limit: 50, sortBy: "score", order: "asc", maxScore: 0.5,
    });
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((m) => m.cfScore <= 0.5)).toBe(true);
  });

  test("filters by profileId", async () => {
    const inst = (await instanceService.getAll())[0];
    const result = await movieService.getFlaggedMovies(inst.id, {
      page: 1, limit: 50, sortBy: "title", order: "asc", profileId: 999,
    });
    expect(result.items).toEqual([]);
  });

  test("filters by missingCfIds (single id)", async () => {
    const inst = (await instanceService.getAll())[0];
    const result = await movieService.getFlaggedMovies(inst.id, {
      page: 1, limit: 50, sortBy: "title", order: "asc", missingCfIds: [10],
    });
    expect(result.items.length).toBeGreaterThan(0);
  });

  test("filters by missingCfIds (multiple ids — ALL match, default)", async () => {
    const inst = (await instanceService.getAll())[0];
    const result = await movieService.getFlaggedMovies(inst.id, {
      page: 1, limit: 50, sortBy: "title", order: "asc", missingCfIds: [10, 999],
    });
    // 999 doesn't exist on any item; default ALL-match empties the result.
    expect(result.items).toEqual([]);
  });

  test("filters by missingCfIds (multiple ids — ANY match)", async () => {
    const inst = (await instanceService.getAll())[0];
    const result = await movieService.getFlaggedMovies(inst.id, {
      page: 1, limit: 50, sortBy: "title", order: "asc",
      missingCfIds: [10, 999], missingCfMatch: "any",
    });
    // ANY-match: items missing 10 still pass, even though 999 doesn't exist.
    expect(result.items.length).toBeGreaterThan(0);
  });
});

describe("MovieService.getFlaggedMovies — error paths", () => {
  test("throws when instance is missing", async () => {
    await expect(
      movieService.getFlaggedMovies(99999, { page: 1, limit: 50, sortBy: "score", order: "asc" }),
    ).rejects.toThrow(/not found/);
  });
});

describe("MovieService.getFlaggedMovies — sort edge cases", () => {
  beforeEach(async () => {
    const instance = await instanceService.create(baseInstance);
    await preferenceRepository.setForInstance(instance.id, [{ cfId: 10, cfName: "HDR" }]);
    setupRadarrMocks({
      movies: [
        { id: 1, title: "Has-File", year: 2024, qualityProfileId: 1, hasFile: true, movieFileId: 1 },
        { id: 2, title: "No-File", year: 2024, qualityProfileId: 1, hasFile: false, movieFileId: 0 },
        { id: 3, title: "Also-No-File", year: 2024, qualityProfileId: 1, hasFile: false, movieFileId: 0 },
      ],
      files: [{ id: 1, movieId: 1, size: 100, customFormats: [], customFormatScore: 0 }],
      profiles: [profile],
    });
  });

  test("score sort pushes fileless movies to the end", async () => {
    const inst = (await instanceService.getAll())[0];
    const result = await movieService.getFlaggedMovies(inst.id, {
      page: 1, limit: 50, sortBy: "score", order: "asc",
    });
    expect(result.items[result.items.length - 1].hasFile).toBe(false);
  });

  test("size sort puts fileless movies last with two no-files comparing as equal", async () => {
    const inst = (await instanceService.getAll())[0];
    const result = await movieService.getFlaggedMovies(inst.id, {
      page: 1, limit: 50, sortBy: "size", order: "desc",
    });
    expect(result.items[0].title).toBe("Has-File");
  });

  test("'added' sort uses default no-op comparator", async () => {
    const inst = (await instanceService.getAll())[0];
    const result = await movieService.getFlaggedMovies(inst.id, {
      page: 1, limit: 50, sortBy: "added", order: "asc",
    });
    expect(result.items).toHaveLength(3);
  });

  test("hasNegativeCfIds filter excludes movies without any unwanted CF", async () => {
    const inst = (await instanceService.getAll())[0];
    const result = await movieService.getFlaggedMovies(inst.id, {
      page: 1, limit: 50, sortBy: "title", order: "asc", hasNegativeCfIds: [12],
    });
    expect(result.items).toEqual([]);
  });
});

describe("MovieService — cache reuse", () => {
  test("second call within TTL returns cached data without re-fetching", async () => {
    const instance = await instanceService.create(baseInstance);
    await preferenceRepository.setForInstance(instance.id, [{ cfId: 10, cfName: "HDR" }]);
    setupRadarrMocks({
      movies: [{ id: 1, title: "A", year: 2024, qualityProfileId: 1, hasFile: true, movieFileId: 100 }],
      files: [{ id: 100, movieId: 1, size: 1024, customFormats: [], customFormatScore: 0 }],
      profiles: [profile],
    });
    await movieService.getFlaggedMovies(instance.id, { page: 1, limit: 50, sortBy: "score", order: "asc" });
    const callsAfterFirst = fetchMock.mock.calls.length;
    await movieService.getFlaggedMovies(instance.id, { page: 1, limit: 50, sortBy: "score", order: "asc" });
    // Cache hit means no additional fetch calls.
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst);
  });
});

describe("MovieService.triggerSearch", () => {
  test("creates a successful action log when live", async () => {
    const instance = await instanceService.create(baseInstance);
    setupRadarrMocks({ movies: [], files: [], profiles: [] });
    const log = await movieService.triggerSearch(instance.id, 1, "A");
    expect(log.status).toBe("success");
    expect(log.action).toBe("search");
  });

  test("creates a dry_run log when dry-run is enabled", async () => {
    const instance = await instanceService.create(baseInstance);
    await configRepository.set("dryRun", "true");
    setupRadarrMocks({ movies: [], files: [], profiles: [] });
    const log = await movieService.triggerSearch(instance.id, 1, "A");
    expect(log.status).toBe("dry_run");
    expect(log.isDryRun).toBe(true);
  });

  test("creates a failed action log when the upstream call throws", async () => {
    const instance = await instanceService.create(baseInstance);
    fetchMock.mockResolvedValue(new Response("nope", { status: 500 }));
    const log = await movieService.triggerSearch(instance.id, 1, "A");
    expect(log.status).toBe("failed");
    expect(log.error).toBeTruthy();
  });

  test("throws when instance is missing", async () => {
    await expect(movieService.triggerSearch(99999, 1, "A")).rejects.toThrow(/not found/);
  });
});

describe("MovieService.deleteFile", () => {
  test("deletes the file and triggers a follow-up search by default", async () => {
    const instance = await instanceService.create(baseInstance);
    setupRadarrMocks({ movies: [], files: [], profiles: [] });
    const log = await movieService.deleteFile(instance.id, 1, 100, "A");
    expect(log.status).toBe("success");
    expect(log.action).toBe("delete");
    // Verify both DELETE and command were issued.
    const calls = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(calls.some((u) => u.includes("/moviefile/100"))).toBe(true);
    expect(calls.some((u) => u.includes("/command"))).toBe(true);
  });

  test("skips the follow-up search when triggerSearch=false", async () => {
    const instance = await instanceService.create(baseInstance);
    setupRadarrMocks({ movies: [], files: [], profiles: [] });
    await movieService.deleteFile(instance.id, 1, 100, "A", false);
    const calls = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(calls.some((u) => u.includes("/command"))).toBe(false);
  });

  test("throws when instance is missing", async () => {
    await expect(movieService.deleteFile(99999, 1, 100, "A")).rejects.toThrow(/not found/);
  });

  test("ActionLog records dry-run correctly", async () => {
    const instance = await instanceService.create(baseInstance);
    await configRepository.set("dryRun", "true");
    const log = await movieService.deleteFile(instance.id, 1, 100, "A");
    expect(log.status).toBe("dry_run");
    expect(await logRepository.findById(log.id)).not.toBeNull();
  });
});
