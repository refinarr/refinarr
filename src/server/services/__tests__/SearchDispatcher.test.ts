import { describe, test, expect, beforeEach } from "vitest";
import { searchDispatcher } from "@/server/services/SearchDispatcher";
import { instanceService } from "@/server/services/InstanceService";
import { configRepository } from "@/server/repositories/ConfigRepository";
import { searchQueueRepository } from "@/server/repositories/SearchQueueRepository";

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

async function setDryRun(on: boolean) {
  await configRepository.set("dryRun", on ? "true" : "false");
}

describe("SearchDispatcher", () => {
  beforeEach(async () => {
    await setDryRun(false);
  });

  // ── Live mode — enqueues with isDryRun=false ──────────────────────────

  test("live mode: movie action enqueues a pending row with isDryRun=false", async () => {
    const inst = await instanceService.create(baseRadarr);
    const result = await searchDispatcher.dispatch({
      action: "movie",
      instanceId: inst.id,
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
    const inst = await instanceService.create(baseSonarr);
    const result = await searchDispatcher.dispatch({
      action: "series",
      instanceId: inst.id,
      mediaId: 7,
      title: "Series Title",
    });

    expect(result.kind).toBe("queued");
    expect(result.isDryRun).toBe(false);
    const row = await searchQueueRepository.findById(result.queueId);
    expect(row?.action).toBe("series");
  });

  test("live mode: season action persists seasonNumber in payload", async () => {
    const inst = await instanceService.create(baseSonarr);
    const result = await searchDispatcher.dispatch({
      action: "season",
      instanceId: inst.id,
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
    const inst = await instanceService.create(baseSonarr);
    const result = await searchDispatcher.dispatch({
      action: "episode",
      instanceId: inst.id,
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
    const inst = await instanceService.create(baseRadarr);
    const groupId = "abcd1234abcd1234abcd1234abcd1234";
    const result = await searchDispatcher.dispatch({
      action: "movie",
      instanceId: inst.id,
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
    const inst = await instanceService.create(baseRadarr);
    const result = await searchDispatcher.dispatch({
      action: "movie",
      instanceId: inst.id,
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
    const inst = await instanceService.create(baseSonarr);
    const result = await searchDispatcher.dispatch({
      action: "series",
      instanceId: inst.id,
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
    const inst = await instanceService.create(baseSonarr);
    const result = await searchDispatcher.dispatch({
      action: "season",
      instanceId: inst.id,
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
    const inst = await instanceService.create(baseSonarr);
    const result = await searchDispatcher.dispatch({
      action: "episode",
      instanceId: inst.id,
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
});
