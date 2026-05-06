import { describe, test, expect } from "vitest";
import { MediaService } from "@/server/services/MediaService";
import { instanceService } from "@/server/services/InstanceService";
import type { FlaggedMedia, MediaQuery } from "@/shared/types/models";

// Minimal subclass that exposes the protected `executeAction` so we can
// drive its branches directly. Production subclasses (MovieService,
// SeriesService) always pass a payload, so the no-payload path needs to
// be reached through a test-only seam.
class TestMediaService extends MediaService<FlaggedMedia> {
  protected readonly cacheNamespace = "test";

  protected getFlaggedForWarm(
    _instanceId: number,
    _query: MediaQuery,
  ): Promise<{ items: FlaggedMedia[]; total: number }> {
    return Promise.resolve({ items: [], total: 0 });
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
