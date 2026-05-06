import { describe, test, expect } from "vitest";
import { MediaService } from "@/server/services/MediaService";
import { instanceService } from "@/server/services/InstanceService";
import { LogSource } from "@/server/lib/log-sources";
import type { FlaggedMedia, MediaQuery } from "@/shared/types/models";

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
    return this.applyQuery(cached.flagged, query, "manual", () => true);
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
