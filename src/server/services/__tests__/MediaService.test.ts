import { describe, test, expect } from "vitest";
import { MediaService } from "@/server/services/MediaService";
import { instanceService } from "@/server/services/InstanceService";
// Type-only client imports — used inside `expect(...).toBeInstanceOf` /
// runtime-result checks but not constructed directly. Keeps the
// "subclasses constructed only via ArrClientFactory" rule intact.
import { RadarrClient } from "@/server/clients/RadarrClient";
import { SonarrClient } from "@/server/clients/SonarrClient";
import { LogSource } from "@/server/lib/log-sources";
import type {
  ArrType,
  MediaItem,
  MediaQuery,
  ScoringMode,
} from "@/shared/types/models";

// Minimal subclass that exposes the protected `executeAction` so we can
// drive its branches directly. Production subclasses (MovieService,
// SeriesService) always pass a payload, so the no-payload path needs to
// be reached through a test-only seam.
class TestMediaService extends MediaService<MediaItem> {
  protected readonly cacheNamespace: string;
  lastWarmQuery: MediaQuery | null = null;

  constructor(
    cacheNamespace = "test",
    private readonly items: MediaItem[] = [],
  ) {
    super();
    this.cacheNamespace = cacheNamespace;
  }

  protected async getForWarm(
    instanceId: number,
    query: MediaQuery,
  ): Promise<{ items: MediaItem[]; total: number }> {
    this.lastWarmQuery = query;
    const cached = await this.readWithSwr<{ items: MediaItem[] }>({
      cacheKey: this.mediaCacheKey(instanceId, "manual"),
      instanceId,
      logSource: LogSource.MovieService,
      backgroundErrorMessage: "Test media rebuild failed",
      build: async () => ({ items: this.items }),
    });
    return this.applyQuery(cached.items, query, "manual");
  }

  // Test-only seam over the protected applyQuery so the filter-branch
  // tests below can drive it directly with arbitrary query + mode.
  runQuery<T extends MediaItem>(
    source: T[],
    query: MediaQuery,
    mode: ScoringMode = "manual",
  ): { items: T[]; total: number } {
    return this.applyQuery(source, query, mode);
  }

  // Test-only seam over the protected withClient so we can assert its
  // success / not-found / type-mismatch behavior without going through
  // one of the service action methods.
  runWithClient(instanceId: number) {
    return this.withClient(instanceId);
  }
  runWithClientTyped<T extends ArrType>(instanceId: number, expectedType: T) {
    return this.withClient(instanceId, expectedType);
  }

  runAction(opts: {
    instanceId: number;
    instanceName: string;
    withPayload: boolean;
    groupId?: string;
    commandId?: number;
  }) {
    return this.executeAction({
      instanceName: opts.instanceName,
      instanceId: opts.instanceId,
      action: "search",
      mediaId: 42,
      title: "test-title",
      ...(opts.withPayload ? { payload: { ok: true } } : {}),
      ...(opts.groupId ? { groupId: opts.groupId } : {}),
      run: async () =>
        opts.commandId !== undefined
          ? { commandId: opts.commandId }
          : undefined,
    });
  }
}

const testService = new TestMediaService();

function makeMediaItem(id: number): MediaItem {
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

  // Foundation for the History UI's parent/child grouping. The bulk
  // client generates one UUID for the whole submission, sends it on
  // every per-item POST, and the server stamps it on each ActionLog
  // row. Same value across siblings → collapsible parent.
  test("stamps groupId on the ActionLog row when caller provides one", async () => {
    const inst = await instanceService.create(baseInstance);
    const groupId = "11111111-2222-3333-4444-555555555555";
    const log = await testService.runAction({
      instanceId: inst.id,
      instanceName: inst.name,
      withPayload: false,
      groupId,
    });
    expect(log.groupId).toBe(groupId);
    expect(log.commandId).toBeNull();
  });

  // Foundation for the future webhook / polling status update PR — the
  // upstream Radarr/Sonarr command id captured from the response feeds
  // the join key for "this grab event matches that ActionLog row."
  test("stamps commandId on the ActionLog row when run() returns one", async () => {
    const inst = await instanceService.create(baseInstance);
    const log = await testService.runAction({
      instanceId: inst.id,
      instanceName: inst.name,
      withPayload: false,
      commandId: 7777,
    });
    expect(log.commandId).toBe(7777);
    expect(log.status).toBe("searched");
  });

  // Both stamps coexist — they're orthogonal. groupId clusters siblings
  // for UI; commandId joins each row to its upstream task.
  test("stamps both groupId and commandId together when both supplied", async () => {
    const inst = await instanceService.create(baseInstance);
    const groupId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const log = await testService.runAction({
      instanceId: inst.id,
      instanceName: inst.name,
      withPayload: false,
      groupId,
      commandId: 9999,
    });
    expect(log.groupId).toBe(groupId);
    expect(log.commandId).toBe(9999);
  });
});

describe("MediaService flagged cache contract", () => {
  test("warmMediaCache populates getCachedFlaggedCount by namespace", async () => {
    const instanceId = 1;
    const service = new TestMediaService("test", [
      makeMediaItem(1),
      makeMediaItem(2),
    ]);
    const otherService = new TestMediaService("other", [makeMediaItem(3)]);

    expect(service.getCachedFlaggedCount(instanceId, "manual")).toBeNull();
    expect(otherService.getCachedFlaggedCount(instanceId, "manual")).toBeNull();

    await expect(service.warmMediaCache(instanceId)).resolves.toEqual({
      items: [makeMediaItem(1)],
      total: 2,
    });

    expect(service.lastWarmQuery).toEqual({
      page: 1,
      limit: 1,
      sortBy: "score",
      order: "asc",
    });
    expect(service.getCachedFlaggedCount(instanceId, "manual")).toBe(2);
    expect(otherService.getCachedFlaggedCount(instanceId, "manual")).toBeNull();

    await otherService.warmMediaCache(instanceId);

    expect(service.getCachedFlaggedCount(instanceId, "manual")).toBe(2);
    expect(otherService.getCachedFlaggedCount(instanceId, "manual")).toBe(1);
  });

  // Regression: pre-fix, getCachedFlaggedCount returned cache size,
  // not the flagged subset. With the cache now holding every visible
  // item (each tagged with `flagged: boolean`), the count must filter
  // on `flagged === true` so the dashboard KPI reports the actual
  // flagged count rather than the library size.
  test("getCachedFlaggedCount filters on per-item `flagged`; getCachedTotalCount returns library size", async () => {
    const instanceId = 1;
    const service = new TestMediaService("kpi-mix", [
      { ...makeMediaItem(1), flagged: true },
      { ...makeMediaItem(2), flagged: false },
      { ...makeMediaItem(3), flagged: true },
      { ...makeMediaItem(4), flagged: false },
      { ...makeMediaItem(5), flagged: false },
    ]);

    await service.warmMediaCache(instanceId);

    expect(service.getCachedFlaggedCount(instanceId, "manual")).toBe(2);
    expect(service.getCachedTotalCount(instanceId, "manual")).toBe(5);
  });

  test("getCachedTotalCount is null on cold cache, matching getCachedFlaggedCount", () => {
    const service = new TestMediaService("cold");
    expect(service.getCachedFlaggedCount(1, "manual")).toBeNull();
    expect(service.getCachedTotalCount(1, "manual")).toBeNull();
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
    const a: MediaItem = {
      ...makeMediaItem(1),
      qualityProfileId: 10,
      cfScore: 0.1,
      sizeOnDisk: 500_000_000, // 500 MB
    };
    const b: MediaItem = {
      ...makeMediaItem(2),
      qualityProfileId: 20,
      cfScore: 0.5,
      sizeOnDisk: 5_000_000_000, // 5 GB
    };
    const c: MediaItem = {
      ...makeMediaItem(3),
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
      { ...makeMediaItem(1), flagged: true },
      { ...makeMediaItem(2), flagged: false },
      { ...makeMediaItem(3), flagged: true },
    ];
    const result = testService.runQuery(mixed, baseQuery);
    expect(result.items.map((m) => m.id).sort()).toEqual([1, 3]);
  });

  test("flaggedOnly: false returns the full library", () => {
    const mixed = [
      { ...makeMediaItem(1), flagged: true },
      { ...makeMediaItem(2), flagged: false },
      { ...makeMediaItem(3), flagged: true },
    ];
    const result = testService.runQuery(mixed, {
      ...baseQuery,
      flaggedOnly: false,
    });
    expect(result.items.map((m) => m.id).sort()).toEqual([1, 2, 3]);
  });

  test("monitorStatus 'unmonitored' returns only !monitored items", () => {
    const mixed = [
      { ...makeMediaItem(1), monitored: true },
      { ...makeMediaItem(2), monitored: false },
      { ...makeMediaItem(3), monitored: true },
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
        ...makeMediaItem(1),
        monitored: true,
        existingFileCount: 10,
        totalFileCount: 10,
      },
      {
        ...makeMediaItem(2),
        monitored: true,
        existingFileCount: 1,
        totalFileCount: 100,
      },
      {
        ...makeMediaItem(3),
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
      ...makeMediaItem(1),
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

  test("typed form succeeds when the instance matches the expected arr type", async () => {
    const sonarr = await instanceService.create({
      ...baseInstance,
      type: "sonarr",
      name: "Typed Sonarr",
      url: "http://192.168.1.30:8989",
    });
    const result = await testService.runWithClientTyped(sonarr.id, "sonarr");
    expect(result.client).toBeInstanceOf(SonarrClient);
  });

  test("typed form throws when the instance type doesn't match (no unchecked cast)", async () => {
    // Create a Radarr instance and ask for "sonarr" — the runtime check
    // should fire and prevent a class mismatch slipping through.
    const radarr = await instanceService.create({
      ...baseInstance,
      name: "Mismatched Radarr",
    });
    await expect(
      testService.runWithClientTyped(radarr.id, "sonarr"),
    ).rejects.toThrow(/expected sonarr/);
  });
});
