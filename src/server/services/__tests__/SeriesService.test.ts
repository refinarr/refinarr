import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { seriesService } from "@/server/arr/composition";
import { instanceService } from "@/server/services/InstanceService";
import { preferenceRepository } from "@/server/repositories/PreferenceRepository";
import { ignoreRepository } from "@/server/repositories/IgnoreRepository";
import type { ScoringMode } from "@/shared/types/models";

// Tests are explicit about scoringMode rather than relying on the column
// default ("profile"), so a future default-flip doesn't silently break them.
async function createInstance(scoringMode: ScoringMode = "manual") {
  return instanceService.create({ ...baseInstance, scoringMode });
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

const baseInstance = {
  type: "sonarr" as const,
  name: "Test Sonarr",
  url: "http://192.168.1.10:8989",
  apiKey: "abcd1234abcd1234abcd1234abcd1234",
};

interface SonarrSeries {
  id: number;
  title: string;
  year: number;
  qualityProfileId: number;
  // Optional in test fixtures — defaulted in `setupSonarrMocks` so
  // existing seeds don't need to be touched.
  monitored?: boolean;
  seasons?: Array<{
    seasonNumber: number;
    monitored: boolean;
    statistics?: { episodeCount: number; episodeFileCount: number };
  }>;
}
interface SonarrFile {
  id: number;
  seriesId: number;
  seasonNumber: number;
  relativePath: string;
  size: number;
  customFormats: Array<{ id: number; name: string }>;
  customFormatScore: number;
}
interface SonarrProfile {
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

function setupSonarrMocks(opts: {
  series: SonarrSeries[];
  files: Map<number, SonarrFile[]>;
  profiles: SonarrProfile[];
  episodes?: Array<{
    id: number;
    episodeFileId: number;
    seasonNumber: number;
    episodeNumber: number;
  }>;
}) {
  // Default `monitored: true` and a single fully-downloaded season per
  // seeded series. Tests that need different counts (e.g. partially
  // missing episodes) can pass `seasons` explicitly on the seed.
  const seriesWithDefaults = opts.series.map((s) => ({
    monitored: true,
    seasons: [
      {
        seasonNumber: 1,
        monitored: true,
        statistics: {
          episodeCount: opts.files.get(s.id)?.length ?? 0,
          episodeFileCount: opts.files.get(s.id)?.length ?? 0,
        },
      },
    ],
    ...s,
  }));
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/api/v3/series")) return jsonResponse(seriesWithDefaults);
    if (url.endsWith("/api/v3/qualityprofile"))
      return jsonResponse(opts.profiles);
    if (url.includes("/api/v3/episodefile?seriesId=")) {
      const id = Number(url.split("seriesId=")[1]);
      return jsonResponse(opts.files.get(id) ?? []);
    }
    if (url.includes("/api/v3/episodefile/"))
      return new Response("", { status: 200 });
    if (url.includes("/api/v3/command")) return jsonResponse({ id: 1 });
    if (url.includes("/api/v3/episode?seriesId=")) {
      return jsonResponse(opts.episodes ?? []);
    }
    return new Response("not mocked: " + url + " " + init?.method, {
      status: 404,
    });
  });
}

const profile: SonarrProfile = {
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

describe("SeriesService.getSeries — manual mode", () => {
  test("returns empty when no preferences are set", async () => {
    const instance = await createInstance("manual");
    setupSonarrMocks({ series: [], files: new Map(), profiles: [] });
    const result = await seriesService.getSeries(instance.id, {
      page: 1,
      limit: 50,
      sortBy: "score",
      order: "asc",
    });
    expect(result.items).toEqual([]);
  });

  test("flags series with episode files missing wanted CFs", async () => {
    const instance = await createInstance("manual");
    await preferenceRepository.setForInstance(instance.id, [
      { cfId: 10, cfName: "HDR" },
    ]);
    setupSonarrMocks({
      series: [{ id: 1, title: "Show A", year: 2024, qualityProfileId: 1 }],
      files: new Map([
        [
          1,
          [
            {
              id: 100,
              seriesId: 1,
              seasonNumber: 1,
              relativePath: "S01E01.mkv",
              size: 1024,
              customFormats: [],
              customFormatScore: 0,
            },
          ],
        ],
      ]),
      profiles: [profile],
    });
    const result = await seriesService.getSeries(instance.id, {
      page: 1,
      limit: 50,
      sortBy: "title",
      order: "asc",
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("Show A");
    expect(result.items[0].episodeFiles).toHaveLength(1);
  });

  test("flags series with no episode files", async () => {
    const instance = await createInstance("manual");
    await preferenceRepository.setForInstance(instance.id, [
      { cfId: 10, cfName: "HDR" },
    ]);
    setupSonarrMocks({
      series: [{ id: 1, title: "Empty", year: 2024, qualityProfileId: 1 }],
      files: new Map([[1, []]]),
      profiles: [profile],
    });
    const result = await seriesService.getSeries(instance.id, {
      page: 1,
      limit: 50,
      sortBy: "title",
      order: "asc",
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].episodeFiles).toEqual([]);
  });

  test("excludes ignored series", async () => {
    const instance = await createInstance("manual");
    await preferenceRepository.setForInstance(instance.id, [
      { cfId: 10, cfName: "HDR" },
    ]);
    await ignoreRepository.create({
      instanceId: instance.id,
      mediaId: 1,
      mediaType: "series",
      title: "Show A",
    });
    setupSonarrMocks({
      series: [{ id: 1, title: "Show A", year: 2024, qualityProfileId: 1 }],
      files: new Map([
        [
          1,
          [
            {
              id: 100,
              seriesId: 1,
              seasonNumber: 1,
              relativePath: "S01E01.mkv",
              size: 1024,
              customFormats: [],
              customFormatScore: 0,
            },
          ],
        ],
      ]),
      profiles: [profile],
    });
    const result = await seriesService.getSeries(instance.id, {
      page: 1,
      limit: 50,
      sortBy: "score",
      order: "asc",
    });
    expect(result.items).toEqual([]);
  });
});

describe("SeriesService.getSeries — profile mode", () => {
  test("flags series whose worst episode score is below cutoff", async () => {
    const instance = await createInstance("profile");
    setupSonarrMocks({
      series: [{ id: 1, title: "BelowCut", year: 2024, qualityProfileId: 1 }],
      files: new Map([
        [
          1,
          [
            {
              id: 100,
              seriesId: 1,
              seasonNumber: 1,
              relativePath: "S01E01.mkv",
              size: 1024,
              customFormats: [],
              customFormatScore: 50,
            },
          ],
        ],
      ]),
      profiles: [profile],
    });
    const result = await seriesService.getSeries(instance.id, {
      page: 1,
      limit: 50,
      sortBy: "score",
      order: "asc",
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].minProfileScore).toBe(100);
  });

  test("flags fileless series when profile cutoff > 0", async () => {
    const instance = await createInstance("profile");
    setupSonarrMocks({
      series: [{ id: 1, title: "NoFiles", year: 2024, qualityProfileId: 1 }],
      files: new Map([[1, []]]),
      profiles: [profile],
    });
    const result = await seriesService.getSeries(instance.id, {
      page: 1,
      limit: 50,
      sortBy: "score",
      order: "asc",
    });
    expect(result.items).toHaveLength(1);
  });

  test("missingFormats carry their profile score (matches the CustomFormat type)", async () => {
    const instance = await createInstance("profile");
    setupSonarrMocks({
      series: [{ id: 1, title: "S", year: 2024, qualityProfileId: 1 }],
      files: new Map([
        [
          1,
          [
            {
              id: 100,
              seriesId: 1,
              seasonNumber: 1,
              relativePath: "S01E01.mkv",
              size: 1024,
              // File missing every positive CF → both HDR (50) and Atmos
              // (30) should aggregate into the series-level missingFormats
              // with their scores.
              customFormats: [],
              customFormatScore: 0,
            },
          ],
        ],
      ]),
      profiles: [profile],
    });
    const result = await seriesService.getSeries(instance.id, {
      page: 1,
      limit: 50,
      sortBy: "score",
      order: "asc",
    });
    expect(result.items[0].missingFormats).toEqual(
      expect.arrayContaining([
        { id: 10, name: "HDR", score: 50 },
        { id: 11, name: "Atmos", score: 30 },
      ]),
    );
  });

  test("populates unwantedFormats from negative-score CFs in episode files", async () => {
    const instance = await createInstance("profile");
    setupSonarrMocks({
      series: [{ id: 1, title: "BadFile", year: 2024, qualityProfileId: 1 }],
      files: new Map([
        [
          1,
          [
            {
              id: 100,
              seriesId: 1,
              seasonNumber: 1,
              relativePath: "S01E01.mkv",
              size: 1024,
              customFormats: [
                { id: 12, name: "x265" },
                { id: 10, name: "HDR" },
              ],
              customFormatScore: 40,
            },
          ],
        ],
      ]),
      profiles: [profile],
    });
    const result = await seriesService.getSeries(instance.id, {
      page: 1,
      limit: 50,
      sortBy: "score",
      order: "asc",
    });
    expect(result.items[0].unwantedFormats.map((c) => c.name)).toEqual([
      "x265",
    ]);
    // Episode file customFormats should include score lookup from the profile.
    const ef = result.items[0].episodeFiles[0];
    expect(ef.customFormats.find((c) => c.id === 10)?.score).toBe(50);
    expect(ef.unwantedFormats.find((c) => c.id === 12)?.score).toBe(-10);
  });

  test("profile mode populates episodeFiles[].customFormats with profile scores", async () => {
    const instance = await createInstance("profile");
    await preferenceRepository.setForInstance(instance.id, [
      { cfId: 11, cfName: "Atmos" },
    ]);
    setupSonarrMocks({
      series: [{ id: 1, title: "Show", year: 2024, qualityProfileId: 1 }],
      files: new Map([
        [
          1,
          [
            {
              id: 100,
              seriesId: 1,
              seasonNumber: 1,
              relativePath: "S01E01.mkv",
              size: 1024,
              customFormats: [{ id: 10, name: "HDR" }],
              customFormatScore: 50,
            },
          ],
        ],
      ]),
      profiles: [profile],
    });
    const result = await seriesService.getSeries(instance.id, {
      page: 1,
      limit: 50,
      sortBy: "score",
      order: "asc",
    });
    const ef = result.items[0].episodeFiles[0];
    expect(ef.customFormats.find((c) => c.id === 10)?.score).toBe(50);
  });
});

describe("SeriesService — query application", () => {
  beforeEach(async () => {
    const instance = await createInstance("manual");
    await preferenceRepository.setForInstance(instance.id, [
      { cfId: 10, cfName: "HDR" },
    ]);
    setupSonarrMocks({
      series: [
        { id: 1, title: "Alpha", year: 2024, qualityProfileId: 1 },
        { id: 2, title: "Bravo", year: 2024, qualityProfileId: 1 },
      ],
      files: new Map([
        [
          1,
          [
            {
              id: 10,
              seriesId: 1,
              seasonNumber: 1,
              relativePath: "a.mkv",
              size: 100,
              customFormats: [],
              customFormatScore: 0,
            },
          ],
        ],
        [
          2,
          [
            {
              id: 20,
              seriesId: 2,
              seasonNumber: 1,
              relativePath: "b.mkv",
              size: 500,
              customFormats: [],
              customFormatScore: 0,
            },
          ],
        ],
      ]),
      profiles: [profile],
    });
  });

  test("filters by query string", async () => {
    const inst = (await instanceService.getAll())[0];
    const result = await seriesService.getSeries(inst.id, {
      page: 1,
      limit: 50,
      sortBy: "title",
      order: "asc",
      q: "alpha",
    });
    expect(result.items.map((s) => s.title)).toEqual(["Alpha"]);
  });

  test("filters by maxScore", async () => {
    const inst = (await instanceService.getAll())[0];
    const result = await seriesService.getSeries(inst.id, {
      page: 1,
      limit: 50,
      sortBy: "score",
      order: "asc",
      maxScore: 0.1,
    });
    expect(result.items.length).toBeGreaterThan(0);
  });

  test("sorts by size descending", async () => {
    const inst = (await instanceService.getAll())[0];
    const result = await seriesService.getSeries(inst.id, {
      page: 1,
      limit: 50,
      sortBy: "size",
      order: "desc",
    });
    expect(result.items.map((s) => s.title)).toEqual(["Bravo", "Alpha"]);
  });
});

describe("SeriesService — actions", () => {
  test("triggerSearch creates a searched log", async () => {
    const instance = await instanceService.create(baseInstance);
    setupSonarrMocks({ series: [], files: new Map(), profiles: [] });
    const log = await seriesService.triggerSearch(instance.id, 1, "Show");
    expect(log.status).toBe("searched");
  });

  test("triggerSeasonSearch creates a searched log", async () => {
    const instance = await instanceService.create(baseInstance);
    setupSonarrMocks({ series: [], files: new Map(), profiles: [] });
    const log = await seriesService.triggerSeasonSearch(
      instance.id,
      1,
      2,
      "Show",
    );
    expect(log.status).toBe("searched");
  });

  test("triggerEpisodeFileSearch resolves episodes for the given file", async () => {
    const instance = await instanceService.create(baseInstance);
    setupSonarrMocks({
      series: [],
      files: new Map(),
      profiles: [],
      episodes: [
        { id: 100, episodeFileId: 999, seasonNumber: 1, episodeNumber: 1 },
        { id: 101, episodeFileId: 1000, seasonNumber: 1, episodeNumber: 2 },
      ],
    });
    const log = await seriesService.triggerEpisodeFileSearch(
      instance.id,
      1,
      999,
      "Show",
    );
    expect(log.status).toBe("searched");
  });

  test("triggerEpisodeFileSearch fails when no matching episode exists", async () => {
    const instance = await instanceService.create(baseInstance);
    setupSonarrMocks({
      series: [],
      files: new Map(),
      profiles: [],
      episodes: [
        { id: 100, episodeFileId: 1, seasonNumber: 1, episodeNumber: 1 },
      ],
    });
    const log = await seriesService.triggerEpisodeFileSearch(
      instance.id,
      1,
      999,
      "Show",
    );
    expect(log.status).toBe("failed");
    expect(log.error).toMatch(/not found/i);
  });

  test("deleteFiles deletes each fileId and optionally triggers a search", async () => {
    const instance = await instanceService.create(baseInstance);
    setupSonarrMocks({ series: [], files: new Map(), profiles: [] });
    const log = await seriesService.deleteFiles(
      instance.id,
      1,
      [10, 11],
      "Show",
      true,
    );
    expect(log.status).toBe("success");
    const calls = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(calls.filter((u) => u.includes("/episodefile/")).length).toBe(2);
    expect(calls.some((u) => u.includes("/command"))).toBe(true);
  });

  test("deleteFiles skips the search by default", async () => {
    const instance = await instanceService.create(baseInstance);
    setupSonarrMocks({ series: [], files: new Map(), profiles: [] });
    await seriesService.deleteFiles(instance.id, 1, [10], "Show");
    // Filter POSTs only — GET /command from statusPoller's refresh
    // tick is unrelated. Contract: no search command was POSTed.
    const commandPosts = fetchMock.mock.calls.filter(
      ([url, init]) =>
        (url as string).includes("/command") &&
        (init as RequestInit | undefined)?.method === "POST",
    );
    expect(commandPosts).toHaveLength(0);
  });

  test("triggerSearch throws when instance is missing", async () => {
    await expect(seriesService.triggerSearch(99999, 1, "Show")).rejects.toThrow(
      /not found/,
    );
  });

  test("triggerSeasonSearch throws when instance is missing", async () => {
    await expect(
      seriesService.triggerSeasonSearch(99999, 1, 1, "Show"),
    ).rejects.toThrow(/not found/);
  });

  test("triggerEpisodeFileSearch throws when instance is missing", async () => {
    await expect(
      seriesService.triggerEpisodeFileSearch(99999, 1, 1, "Show"),
    ).rejects.toThrow(/not found/);
  });

  test("deleteFiles throws when instance is missing", async () => {
    await expect(
      seriesService.deleteFiles(99999, 1, [1], "Show"),
    ).rejects.toThrow(/not found/);
  });

  test("getSeries throws when instance is missing", async () => {
    await expect(
      seriesService.getSeries(99999, {
        page: 1,
        limit: 50,
        sortBy: "score",
        order: "asc",
      }),
    ).rejects.toThrow(/not found/);
  });
});

describe("SeriesService — manual mode with file lacking customFormats", () => {
  test("treats undefined customFormats as empty array on episode files", async () => {
    const instance = await createInstance("manual");
    await preferenceRepository.setForInstance(instance.id, [
      { cfId: 10, cfName: "HDR" },
    ]);
    setupSonarrMocks({
      series: [
        { id: 1, title: "ShowMissingCfs", year: 2024, qualityProfileId: 1 },
      ],
      // Mock returns a file with no customFormats field at all.
      files: new Map([
        [
          1,
          [
            {
              id: 100,
              seriesId: 1,
              seasonNumber: 1,
              relativePath: "S01E01.mkv",
              size: 1024,
            } as never,
          ],
        ],
      ]),
      profiles: [profile],
    });
    const result = await seriesService.getSeries(instance.id, {
      page: 1,
      limit: 50,
      sortBy: "score",
      order: "asc",
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].episodeFiles[0].customFormats).toEqual([]);
  });
});

describe("SeriesService — sort edge cases", () => {
  beforeEach(async () => {
    const instance = await createInstance("manual");
    await preferenceRepository.setForInstance(instance.id, [
      { cfId: 10, cfName: "HDR" },
    ]);
    setupSonarrMocks({
      series: [
        { id: 1, title: "WithFiles", year: 2024, qualityProfileId: 1 },
        { id: 2, title: "NoFiles", year: 2024, qualityProfileId: 1 },
      ],
      files: new Map([
        [
          1,
          [
            {
              id: 10,
              seriesId: 1,
              seasonNumber: 1,
              relativePath: "a.mkv",
              size: 100,
              customFormats: [],
              customFormatScore: 0,
            },
          ],
        ],
        [2, []],
      ]),
      profiles: [profile],
    });
  });

  test("score sort pushes fileless series to the end", async () => {
    const inst = (await instanceService.getAll())[0];
    const result = await seriesService.getSeries(inst.id, {
      page: 1,
      limit: 50,
      sortBy: "score",
      order: "asc",
    });
    expect(result.items[result.items.length - 1].title).toBe("NoFiles");
  });

  test("'added' sort uses default no-op comparator", async () => {
    const inst = (await instanceService.getAll())[0];
    const result = await seriesService.getSeries(inst.id, {
      page: 1,
      limit: 50,
      sortBy: "added",
      order: "asc",
    });
    expect(result.items).toHaveLength(2);
  });

  test("filters by profileIds", async () => {
    const inst = (await instanceService.getAll())[0];
    const result = await seriesService.getSeries(inst.id, {
      page: 1,
      limit: 50,
      sortBy: "title",
      order: "asc",
      profileIds: [999],
    });
    expect(result.items).toEqual([]);
  });

  test("filters by profileIds — multi keeps matches, drops non-matches", async () => {
    // The seeded series both sit on qualityProfileId=1; 999 is unknown.
    // A multi-id filter [1, 999] must keep the matches and silently drop
    // the non-matching id rather than rejecting the whole list.
    const inst = (await instanceService.getAll())[0];
    const result = await seriesService.getSeries(inst.id, {
      page: 1,
      limit: 50,
      sortBy: "title",
      order: "asc",
      profileIds: [1, 999],
    });
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((s) => s.qualityProfileId === 1)).toBe(true);
  });

  test("filters by missingCfIds (single)", async () => {
    const inst = (await instanceService.getAll())[0];
    const result = await seriesService.getSeries(inst.id, {
      page: 1,
      limit: 50,
      sortBy: "title",
      order: "asc",
      missingCfIds: [10],
    });
    expect(result.items.length).toBeGreaterThan(0);
  });

  test("filters by missingCfIds (multiple — ALL match, default)", async () => {
    const inst = (await instanceService.getAll())[0];
    const result = await seriesService.getSeries(inst.id, {
      page: 1,
      limit: 50,
      sortBy: "title",
      order: "asc",
      missingCfIds: [10, 999],
    });
    // 999 doesn't exist on any series; default ALL-match returns empty.
    expect(result.items).toEqual([]);
  });

  test("filters by missingCfIds (multiple — ANY match)", async () => {
    const inst = (await instanceService.getAll())[0];
    const result = await seriesService.getSeries(inst.id, {
      page: 1,
      limit: 50,
      sortBy: "title",
      order: "asc",
      missingCfIds: [10, 999],
      missingCfMatch: "any",
    });
    // ANY-match: series missing 10 still pass.
    expect(result.items.length).toBeGreaterThan(0);
  });

  test("filters by hasNegativeCfIds (no match → empty)", async () => {
    const inst = (await instanceService.getAll())[0];
    const result = await seriesService.getSeries(inst.id, {
      page: 1,
      limit: 50,
      sortBy: "title",
      order: "asc",
      hasNegativeCfIds: [999],
    });
    expect(result.items).toEqual([]);
  });
});

describe("SeriesService — cache reuse", () => {
  test("second call within TTL returns cached data", async () => {
    const instance = await createInstance("manual");
    await preferenceRepository.setForInstance(instance.id, [
      { cfId: 10, cfName: "HDR" },
    ]);
    setupSonarrMocks({
      series: [{ id: 1, title: "Show", year: 2024, qualityProfileId: 1 }],
      files: new Map([
        [
          1,
          [
            {
              id: 10,
              seriesId: 1,
              seasonNumber: 1,
              relativePath: "a.mkv",
              size: 100,
              customFormats: [],
              customFormatScore: 0,
            },
          ],
        ],
      ]),
      profiles: [profile],
    });
    await seriesService.getSeries(instance.id, {
      page: 1,
      limit: 50,
      sortBy: "score",
      order: "asc",
    });
    const callsAfterFirst = fetchMock.mock.calls.length;
    await seriesService.getSeries(instance.id, {
      page: 1,
      limit: 50,
      sortBy: "score",
      order: "asc",
    });
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst);
  });
});

describe("SeriesService.retryFromPayload", () => {
  test("dispatches search payloads to triggerSearch", async () => {
    const instance = await instanceService.create(baseInstance);
    setupSonarrMocks({ series: [], files: new Map(), profiles: [] });
    const log = await seriesService.retryFromPayload({
      action: "search",
      instanceId: instance.id,
      mediaId: 1,
      title: "S",
    });
    expect(log.action).toBe("search");
    expect(log.status).toBe("searched");
  });

  test("dispatches delete payloads to deleteFiles with triggerSearch=true", async () => {
    const instance = await instanceService.create(baseInstance);
    setupSonarrMocks({ series: [], files: new Map(), profiles: [] });
    const log = await seriesService.retryFromPayload({
      action: "delete",
      instanceId: instance.id,
      mediaId: 1,
      fileIds: [10, 11],
      title: "S",
      triggerSearch: true,
    });
    expect(log.action).toBe("delete");
    const calls = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(calls.some((u) => u.includes("/command"))).toBe(true);
  });

  test("throws on unknown action", async () => {
    await expect(
      seriesService.retryFromPayload({
        action: "unknown",
        instanceId: 1,
        mediaId: 1,
        title: "X",
      }),
    ).rejects.toThrow(/Cannot retry/);
  });
});
