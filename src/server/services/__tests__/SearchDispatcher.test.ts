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

  // ── Live (queue) branch — never hits upstream, just enqueues ────────────────

  test("live mode: movie action enqueues a pending row", async () => {
    const inst = await instanceService.create(baseRadarr);
    const result = await searchDispatcher.dispatch({
      action: "movie",
      instanceId: inst.id,
      mediaId: 42,
      title: "Movie Title",
    });

    expect(result.kind).toBe("queued");
    if (result.kind !== "queued") return;
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
    if (result.kind !== "queued") return;
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
    if (result.kind !== "queued") return;
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
    if (result.kind !== "queued") return;
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

    expect(result.kind).toBe("queued");
    if (result.kind !== "queued") return;
    const row = await searchQueueRepository.findById(result.queueId);
    expect(row?.groupId).toBe(groupId);
  });

  // ── Dry-run branch — short-circuits to a logged ActionLog row ───────────────

  test("dry-run mode: movie action returns ActionLog with status=dry_run", async () => {
    await setDryRun(true);
    const inst = await instanceService.create(baseRadarr);
    const result = await searchDispatcher.dispatch({
      action: "movie",
      instanceId: inst.id,
      mediaId: 42,
      title: "Movie Title",
    });

    expect(result.kind).toBe("dryRun");
    if (result.kind !== "dryRun") return;
    expect(result.actionLog.status).toBe("dry_run");
    expect(result.actionLog.action).toBe("search");
    expect(result.actionLog.mediaId).toBe(42);
    expect(result.actionLog.isDryRun).toBe(true);
  });

  test("dry-run mode: series action returns ActionLog with status=dry_run", async () => {
    await setDryRun(true);
    const inst = await instanceService.create(baseSonarr);
    const result = await searchDispatcher.dispatch({
      action: "series",
      instanceId: inst.id,
      mediaId: 7,
      title: "Series Title",
    });

    expect(result.kind).toBe("dryRun");
    if (result.kind !== "dryRun") return;
    expect(result.actionLog.status).toBe("dry_run");
    expect(result.actionLog.action).toBe("search");
    expect(result.actionLog.mediaId).toBe(7);
    expect(result.actionLog.isDryRun).toBe(true);
  });

  test("dry-run mode: season action records search_season action", async () => {
    await setDryRun(true);
    const inst = await instanceService.create(baseSonarr);
    const result = await searchDispatcher.dispatch({
      action: "season",
      instanceId: inst.id,
      mediaId: 7,
      seasonNumber: 3,
      title: "Series Title",
    });

    expect(result.kind).toBe("dryRun");
    if (result.kind !== "dryRun") return;
    expect(result.actionLog.action).toBe("search_season");
    expect(result.actionLog.status).toBe("dry_run");
  });

  test("dry-run mode: episode action records search_episode action", async () => {
    await setDryRun(true);
    const inst = await instanceService.create(baseSonarr);
    const result = await searchDispatcher.dispatch({
      action: "episode",
      instanceId: inst.id,
      mediaId: 7,
      fileId: 99,
      title: "Series Title",
    });

    expect(result.kind).toBe("dryRun");
    if (result.kind !== "dryRun") return;
    expect(result.actionLog.action).toBe("search_episode");
    expect(result.actionLog.status).toBe("dry_run");
  });
});
