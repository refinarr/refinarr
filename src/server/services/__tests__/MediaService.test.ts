import { describe, test, expect } from "vitest";
import { MediaService } from "@/server/services/MediaService";
import { instanceService } from "@/server/services/InstanceService";
import { RadarrClient } from "@/server/clients/RadarrClient";
import { SonarrClient } from "@/server/clients/SonarrClient";
import { LogSource } from "@/server/lib/log-sources";
import type {
  FlaggedMedia,
  MediaQuery,
  ScoringMode,
} from "@/shared/types/models";

// Minimal subclass that exposes the protected `executeAction` so we can
// drive its branches directly. Production subclasses (MovieService,
// SeriesService) always pass a payload, so the no-payload path needs to
// be reached through a test-only seam.
class TestMediaService extends MediaService<FlaggedMedia> {
  protected readonly cacheNamespace: string;
  lastWarmQuery: MediaQuery | null = null;

  constructor(
    cacheNamespace = "test",
    private readonly flagged: FlaggedMedia[] = [],
  ) {
    super();
    this.cacheNamespace = cacheNamespace;
  }

  protected async getFlaggedForWarm(
    instanceId: number,
    query: MediaQuery,
  ): Promise<{ items: FlaggedMedia[]; total: number }> {
    this.lastWarmQuery = query;
    const cached = await this.readWithSwr<{ flagged: FlaggedMedia[] }>({
      cacheKey: this.flaggedCacheKey(instanceId, "manual"),
      instanceId,
      logSource: LogSource.MovieService,
      backgroundErrorMessage: "Test flagged-media rebuild failed",
      build: async () => ({ flagged: this.flagged }),
    });
    return this.applyQuery(cached.flagged, query, "manual");
  }

  // Test-only seam over the protected applyQuery so the filter-branch
  // tests below can drive it directly with arbitrary query + mode.
  runQuery<T extends FlaggedMedia>(
    source: T[],
    query: MediaQuery,
    mode: ScoringMode = "manual",
  ): { items: T[]; total: number } {
    return this.applyQuery(source, query, mode);
  }

  // Test-only seam over the protected withClient so we can assert its
  // success / not-found behavior without going through one of the four
  // service action methods.
  runWithClient(instanceId: number) {
    return this.withClient(instanceId);
  }

  runAction(opts: {
    instanceId: number;
    instanceName: string;
    withPayload: boolean;
  }) {
    return this.executeAction({
      instanceName: opts.instanceName,
      instanceId: opts.instanceId,
      action: "search",
      mediaId: 42,
      title: "test-title",
      ...(opts.withPayload ? { payload: { ok: true } } : {}),
      run: async () => {},
    });
  }
}

const testService = new TestMediaService();

function makeFlaggedMedia(id: number): FlaggedMedia {
  return {
    id,
    title: `Title ${id}`,
    year: 2024,
    qualityProfileId: 1,
    customFormats: [],
    customFormatScore: id,
    cfScore: id / 10,
    missingFormats: [],
    unwantedFormats: [],
    sizeOnDisk: 0,
    monitored: true,
    existingFileCount: 1,
    totalFileCount: 1,
    flagged: true,
  };
}

const baseInstance = {
  type: "radarr" as const,
  name: "Test Radarr",
  url: "http://192.168.1.10:7878",
  apiKey: "abcd1234abcd1234abcd1234abcd1234",
};

describe("MediaService.executeAction", () => {
  test("stores null payload when caller omits it", async () => {
    const inst = await instanceService.create(baseInstance);
    const log = await testService.runAction({
      instanceId: inst.id,
      instanceName: inst.name,
      withPayload: false,
    });
    expect(log.payload).toBeNull();
    expect(log.status).toBe("success");
  });

  test("stores stringified JSON when caller provides a payload", async () => {
    const inst = await instanceService.create(baseInstance);
    const log = await testService.runAction({
      instanceId: inst.id,
      instanceName: inst.name,
      withPayload: true,
    });
    expect(log.payload).toBe(JSON.stringify({ ok: true }));
  });
});

describe("MediaService flagged cache contract", () => {
  test("warmFlaggedCache populates getCachedFlaggedTotal by namespace", async () => {
    const instanceId = 1;
    const service = new TestMediaService("test", [
      makeFlaggedMedia(1),
      makeFlaggedMedia(2),
    ]);
    const otherService = new TestMediaService("other", [makeFlaggedMedia(3)]);

    expect(service.getCachedFlaggedTotal(instanceId, "manual")).toBeNull();
    expect(otherService.getCachedFlaggedTotal(instanceId, "manual")).toBeNull();

    await expect(service.warmFlaggedCache(instanceId)).resolves.toEqual({
      items: [makeFlaggedMedia(1)],
      total: 2,
    });

    expect(service.lastWarmQuery).toEqual({
      page: 1,
      limit: 1,
      sortBy: "score",
      order: "asc",
    });
    expect(service.getCachedFlaggedTotal(instanceId, "manual")).toBe(2);
    expect(otherService.getCachedFlaggedTotal(instanceId, "manual")).toBeNull();

    await otherService.warmFlaggedCache(instanceId);

    expect(service.getCachedFlaggedTotal(instanceId, "manual")).toBe(2);
    expect(otherService.getCachedFlaggedTotal(instanceId, "manual")).toBe(1);
  });
});

describe("MediaService.applyQuery — filter branches", () => {
  // Default query that selects every item; per-test extends with the
  // filter slice under examination.
  const baseQuery: Omit<MediaQuery, never> = {
    page: 1,
    limit: 50,
    sortBy: "score",
    order: "asc",
  };

  function items() {
    // Spread of profileIds, score, and size so the branches can be
    // exercised without writing per-test fixtures.
    const a: FlaggedMedia = {
      ...makeFlaggedMedia(1),
      qualityProfileId: 10,
      cfScore: 0.1,
      sizeOnDisk: 500_000_000, // 500 MB
    };
    const b: FlaggedMedia = {
      ...makeFlaggedMedia(2),
      qualityProfileId: 20,
      cfScore: 0.5,
      sizeOnDisk: 5_000_000_000, // 5 GB
    };
    const c: FlaggedMedia = {
      ...makeFlaggedMedia(3),
      qualityProfileId: 30,
      cfScore: 0.95,
      sizeOnDisk: 30_000_000_000, // 30 GB
    };
    return [a, b, c];
  }

  test("filters by minScore lower bound", () => {
    const result = testService.runQuery(items(), {
      ...baseQuery,
      minScore: 0.4,
    });
    expect(result.items.map((m) => m.id)).toEqual([2, 3]);
  });

  test("filters by maxScore upper bound", () => {
    const result = testService.runQuery(items(), {
      ...baseQuery,
      maxScore: 0.4,
    });
    expect(result.items.map((m) => m.id)).toEqual([1]);
  });

  test("filters by minSize / maxSize range", () => {
    const result = testService.runQuery(items(), {
      ...baseQuery,
      minSize: 1_000_000_000,
      maxSize: 10_000_000_000,
    });
    expect(result.items.map((m) => m.id)).toEqual([2]);
  });

  test("filters by profileIds (multi)", () => {
    const result = testService.runQuery(items(), {
      ...baseQuery,
      profileIds: [10, 30],
    });
    expect(result.items.map((m) => m.id).sort()).toEqual([1, 3]);
  });

  test("filters by severities (manual mode buckets)", () => {
    // cfScore: 0.1 (critical), 0.5 (low), 0.95 (ok). Manual mode reads
    // cfScore directly via SCORE_FOR; no profile cutoff in play.
    const result = testService.runQuery(items(), {
      ...baseQuery,
      severities: ["ok"],
    });
    expect(result.items.map((m) => m.id)).toEqual([3]);
  });

  test("severities + profileIds + range compose (AND)", () => {
    const result = testService.runQuery(items(), {
      ...baseQuery,
      severities: ["low", "ok"],
      profileIds: [20, 30],
      minSize: 4_000_000_000,
    });
    expect(result.items.map((m) => m.id).sort()).toEqual([2, 3]);
  });

  test("flaggedOnly defaults to true — non-flagged items hidden", () => {
    const mixed = [
      { ...makeFlaggedMedia(1), flagged: true },
      { ...makeFlaggedMedia(2), flagged: false },
      { ...makeFlaggedMedia(3), flagged: true },
    ];
    const result = testService.runQuery(mixed, baseQuery);
    expect(result.items.map((m) => m.id).sort()).toEqual([1, 3]);
  });

  test("flaggedOnly: false returns the full library", () => {
    const mixed = [
      { ...makeFlaggedMedia(1), flagged: true },
      { ...makeFlaggedMedia(2), flagged: false },
      { ...makeFlaggedMedia(3), flagged: true },
    ];
    const result = testService.runQuery(mixed, {
      ...baseQuery,
      flaggedOnly: false,
    });
    expect(result.items.map((m) => m.id).sort()).toEqual([1, 2, 3]);
  });

  test("monitorStatus 'unmonitored' returns only !monitored items", () => {
    const mixed = [
      { ...makeFlaggedMedia(1), monitored: true },
      { ...makeFlaggedMedia(2), monitored: false },
      { ...makeFlaggedMedia(3), monitored: true },
    ];
    const result = testService.runQuery(mixed, {
      ...baseQuery,
      monitorStatus: "unmonitored",
    });
    expect(result.items.map((m) => m.id)).toEqual([2]);
  });

  test("monitorStatus 'missing' returns only items with absent files", () => {
    // 1: monitored, fully downloaded → not missing
    // 2: monitored, partial downloads → missing
    // 3: unmonitored, partial downloads → not missing (rule requires monitored)
    const mixed = [
      {
        ...makeFlaggedMedia(1),
        monitored: true,
        existingFileCount: 10,
        totalFileCount: 10,
      },
      {
        ...makeFlaggedMedia(2),
        monitored: true,
        existingFileCount: 1,
        totalFileCount: 100,
      },
      {
        ...makeFlaggedMedia(3),
        monitored: false,
        existingFileCount: 1,
        totalFileCount: 100,
      },
    ];
    const result = testService.runQuery(mixed, {
      ...baseQuery,
      monitorStatus: "missing",
    });
    expect(result.items.map((m) => m.id)).toEqual([2]);
  });

  test("regression: a series with 1-of-100 episodes downloaded is not 'has file'", () => {
    // The retired hasFile callback used to read `episodeFiles.length > 0`
    // which would have returned true here. The replacement field-based
    // check (existingFileCount > 0 only when *any* file is downloaded)
    // still includes this series via existingFileCount=1 — but the
    // monitorStatus="missing" filter correctly captures it as missing.
    const partial = {
      ...makeFlaggedMedia(1),
      monitored: true,
      existingFileCount: 1,
      totalFileCount: 100,
    };
    const result = testService.runQuery([partial], {
      ...baseQuery,
      monitorStatus: "missing",
    });
    expect(result.items.map((m) => m.id)).toEqual([1]);
  });

  test("missing severity bucket flags items without files", () => {
    // Mark every item as having no file → getSeverity returns "missing".
    const noFileItems = items().map((m) => ({
      ...m,
      existingFileCount: 0,
    }));
    const result = testService.runQuery(noFileItems, {
      ...baseQuery,
      severities: ["missing"],
    });
    expect(result.items).toHaveLength(3);
  });
});

describe("MediaService.withClient", () => {
  test("resolves the instance + creates the right ArrClient subclass", async () => {
    const radarr = await instanceService.create({ ...baseInstance });
    const sonarr = await instanceService.create({
      ...baseInstance,
      type: "sonarr",
      name: "Test Sonarr",
      url: "http://192.168.1.20:8989",
    });

    const radarrResult = await testService.runWithClient(radarr.id);
    expect(radarrResult.instance.id).toBe(radarr.id);
    expect(radarrResult.client).toBeInstanceOf(RadarrClient);

    const sonarrResult = await testService.runWithClient(sonarr.id);
    expect(sonarrResult.instance.id).toBe(sonarr.id);
    expect(sonarrResult.client).toBeInstanceOf(SonarrClient);
  });

  test("throws when the instance id doesn't exist", async () => {
    await expect(testService.runWithClient(99_999)).rejects.toThrow(
      /Instance 99999 not found/,
    );
  });
});
