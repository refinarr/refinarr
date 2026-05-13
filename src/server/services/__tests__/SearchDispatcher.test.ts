import { describe, test, expect, beforeEach } from "vitest";
import { searchDispatcher } from "@/server/services/SearchDispatcher";
import { instanceService } from "@/server/services/InstanceService";
import { configRepository } from "@/server/repositories/ConfigRepository";
import { searchQueueRepository } from "@/server/repositories/SearchQueueRepository";
import type { Instance } from "@/shared/types/models";

const baseRadarr = {
  type: "radarr" as const,
  name: "Test Radarr",
  url: "http://192.168.1.10:7878",
  apiKey: "abcd1234abcd1234abcd1234abcd1234",
};

const baseSonarr = {
  type: "sonarr" as const,
  name: "Test Sonarr",
  url: "http://192.168.1.10:8989",
  apiKey: "abcd1234abcd1234abcd1234abcd1234",
};

// Prisma widens the row's `type` to string; narrow it for dispatch
// inputs that pin instance.type per discriminated variant. Routes do
// the equivalent via assertArrType (api-errors.ts).
async function makeRadarr(): Promise<Instance & { type: "radarr" }> {
  const inst = await instanceService.create(baseRadarr);
  return inst as Instance & { type: "radarr" };
}
async function makeSonarr(): Promise<Instance & { type: "sonarr" }> {
  const inst = await instanceService.create(baseSonarr);
  return inst as Instance & { type: "sonarr" };
}

async function setDryRun(on: boolean) {
  await configRepository.set("dryRun", on ? "true" : "false");
}

describe("SearchDispatcher", () => {
  beforeEach(async () => {
    await setDryRun(false);
  });

  // ── Live mode — enqueues with isDryRun=false ──────────────────────────

  test("live mode: movie action enqueues a pending row with isDryRun=false", async () => {
    const inst = await makeRadarr();
    const result = await searchDispatcher.dispatch({
      action: "movie",
      instance: inst,
      mediaId: 42,
      title: "Movie Title",
    });

    expect(result.kind).toBe("queued");
    expect(result.isDryRun).toBe(false);
    const row = await searchQueueRepository.findById(result.queueId);
    expect(row?.action).toBe("movie");
    expect(row?.mediaId).toBe(42);
    expect(row?.status).toBe("pending");
  });

  test("live mode: series action enqueues a pending row", async () => {
    const inst = await makeSonarr();
    const result = await searchDispatcher.dispatch({
      action: "series",
      instance: inst,
      mediaId: 7,
      title: "Series Title",
    });

    expect(result.kind).toBe("queued");
    expect(result.isDryRun).toBe(false);
    const row = await searchQueueRepository.findById(result.queueId);
    expect(row?.action).toBe("series");
  });

  test("live mode: season action persists seasonNumber in payload", async () => {
    const inst = await makeSonarr();
    const result = await searchDispatcher.dispatch({
      action: "season",
      instance: inst,
      mediaId: 7,
      seasonNumber: 3,
      title: "Series Title",
    });

    expect(result.kind).toBe("queued");
    const row = await searchQueueRepository.findById(result.queueId);
    expect(row?.action).toBe("season");
    expect(JSON.parse(row!.payload)).toEqual({ seasonNumber: 3 });
  });

  test("live mode: episode action persists fileId in payload", async () => {
    const inst = await makeSonarr();
    const result = await searchDispatcher.dispatch({
      action: "episode",
      instance: inst,
      mediaId: 7,
      fileId: 99,
      title: "Series Title",
    });

    expect(result.kind).toBe("queued");
    const row = await searchQueueRepository.findById(result.queueId);
    expect(row?.action).toBe("episode");
    expect(JSON.parse(row!.payload)).toEqual({ fileId: 99 });
  });

  test("live mode: groupId is propagated to the queue row", async () => {
    const inst = await makeRadarr();
    const groupId = "abcd1234abcd1234abcd1234abcd1234";
    const result = await searchDispatcher.dispatch({
      action: "movie",
      instance: inst,
      mediaId: 42,
      title: "Movie Title",
      groupId,
    });

    const row = await searchQueueRepository.findById(result.queueId);
    expect(row?.groupId).toBe(groupId);
  });

  // ── Dry-run mode — also enqueues, with isDryRun=true ──────────────────
  // The worker writes the dry_run ActionLog row when it drains. This keeps
  // manual searches consistent with the auto-runner (which always queues)
  // so users see a single, unified pipeline regardless of mode.

  test("dry-run mode: movie action still enqueues a pending row + flags isDryRun=true", async () => {
    await setDryRun(true);
    const inst = await makeRadarr();
    const result = await searchDispatcher.dispatch({
      action: "movie",
      instance: inst,
      mediaId: 42,
      title: "Movie Title",
    });

    expect(result.kind).toBe("queued");
    expect(result.isDryRun).toBe(true);
    const row = await searchQueueRepository.findById(result.queueId);
    expect(row?.status).toBe("pending");
    expect(row?.action).toBe("movie");
    expect(row?.mediaId).toBe(42);
  });

  test("dry-run mode: series action enqueues and flags isDryRun=true", async () => {
    await setDryRun(true);
    const inst = await makeSonarr();
    const result = await searchDispatcher.dispatch({
      action: "series",
      instance: inst,
      mediaId: 7,
      title: "Series Title",
    });

    expect(result.kind).toBe("queued");
    expect(result.isDryRun).toBe(true);
    const row = await searchQueueRepository.findById(result.queueId);
    expect(row?.action).toBe("series");
  });

  test("dry-run mode: season action persists seasonNumber in payload", async () => {
    await setDryRun(true);
    const inst = await makeSonarr();
    const result = await searchDispatcher.dispatch({
      action: "season",
      instance: inst,
      mediaId: 7,
      seasonNumber: 3,
      title: "Series Title",
    });

    expect(result.kind).toBe("queued");
    expect(result.isDryRun).toBe(true);
    const row = await searchQueueRepository.findById(result.queueId);
    expect(row?.action).toBe("season");
    expect(JSON.parse(row!.payload)).toEqual({ seasonNumber: 3 });
  });

  test("dry-run mode: episode action persists fileId in payload", async () => {
    await setDryRun(true);
    const inst = await makeSonarr();
    const result = await searchDispatcher.dispatch({
      action: "episode",
      instance: inst,
      mediaId: 7,
      fileId: 99,
      title: "Series Title",
    });

    expect(result.kind).toBe("queued");
    expect(result.isDryRun).toBe(true);
    const row = await searchQueueRepository.findById(result.queueId);
    expect(row?.action).toBe("episode");
    expect(JSON.parse(row!.payload)).toEqual({ fileId: 99 });
  });

  // The dispatcher routes the input through the owning module's
  // `dispatchExtras` zod schema, which strips unknown keys. Pins the
  // invariant: a TS-bypassed caller can't sneak arbitrary fields into
  // `SearchQueue.payload`.
  test("queuePayload strips unknown keys via the module's zod schema", async () => {
    const inst = await makeSonarr();
    // Cast around TS to simulate a caller that bypassed the type
    // system (e.g. a route that built the dispatch input from
    // user JSON without re-validating).
    const result = await searchDispatcher.dispatch({
      action: "season",
      instance: inst,
      mediaId: 7,
      seasonNumber: 3,
      title: "Series Title",
      // @ts-expect-error — unknown field; should be stripped
      bogusInjected: "ignored",
    });
    const row = await searchQueueRepository.findById(result.queueId);
    expect(JSON.parse(row!.payload)).toEqual({ seasonNumber: 3 });
  });

  // Missing required schema fields fail fast at the dispatcher rather
  // than at the worker's drain time. Pins the invariant: the queue row
  // is never written with a payload the queue handler can't parse.
  test("queuePayload rejects a dispatch missing required schema fields", async () => {
    const inst = await makeSonarr();
    // Cast bypasses TS — simulating a runtime mismatch (e.g. a
    // route that built the input from untyped JSON without
    // pre-validating). The dispatcher's `parseDispatchExtras` step
    // catches it before any DB write.
    await expect(
      searchDispatcher.dispatch({
        action: "season",
        instance: inst,
        mediaId: 7,
        title: "Series Title",
      } as never),
    ).rejects.toThrow();
    expect(await searchQueueRepository.findAll()).toHaveLength(0);
  });
});
