import { describe, test, expect } from "vitest";
import { searchQueueService } from "@/server/services/SearchQueueService";
import { instanceService } from "@/server/services/InstanceService";

const baseRadarr = {
  type: "radarr" as const,
  name: "Test Radarr",
  url: "http://192.168.1.10:7878",
  apiKey: "abcd1234abcd1234abcd1234abcd1234",
};

const baseSonarr = {
  type: "sonarr" as const,
  name: "Test Sonarr",
  url: "http://192.168.1.20:8989",
  apiKey: "abcd1234abcd1234abcd1234abcd1234",
};

async function makeInstance(searchesPerHour = 20) {
  return instanceService.create({ ...baseRadarr, searchesPerHour });
}

async function makeSonarrInstance(searchesPerHour = 20) {
  return instanceService.create({ ...baseSonarr, searchesPerHour });
}

describe("SearchQueueService", () => {
  test("enqueue persists a pending row", async () => {
    const inst = await makeInstance();
    const row = await searchQueueService.enqueue({
      instance: inst,
      action: "movie",
      mediaId: 42,
      title: "X",
    });
    expect(row.status).toBe("pending");
    expect(row.action).toBe("movie");
    expect(row.payload).toBe("{}");
  });

  test("enqueue serializes the payload object", async () => {
    const inst = await makeSonarrInstance();
    const row = await searchQueueService.enqueue({
      instance: inst,
      action: "season",
      mediaId: 7,
      title: "S",
      payload: { seasonNumber: 3 },
    });
    expect(JSON.parse(row.payload)).toEqual({ seasonNumber: 3 });
  });

  test("enqueue dedupes against an existing pending movie row", async () => {
    const inst = await makeInstance();
    const first = await searchQueueService.enqueue({
      instance: inst,
      action: "movie",
      mediaId: 42,
      title: "X",
    });
    const second = await searchQueueService.enqueue({
      instance: inst,
      action: "movie",
      mediaId: 42,
      title: "X",
    });
    expect(second.id).toBe(first.id);
    expect(await searchQueueService.listPending(inst.id)).toHaveLength(1);
  });

  test("enqueue does NOT dedupe after the previous row reached a terminal state", async () => {
    const inst = await makeInstance();
    const first = await searchQueueService.enqueue({
      instance: inst,
      action: "movie",
      mediaId: 42,
      title: "X",
    });
    await searchQueueService.markDone(first.id);
    const second = await searchQueueService.enqueue({
      instance: inst,
      action: "movie",
      mediaId: 42,
      title: "X",
    });
    expect(second.id).not.toBe(first.id);
    expect(second.status).toBe("pending");
  });

  test("enqueue does NOT dedupe across distinct seasons of the same series", async () => {
    const inst = await makeSonarrInstance();
    const s1 = await searchQueueService.enqueue({
      instance: inst,
      action: "season",
      mediaId: 7,
      title: "S",
      payload: { seasonNumber: 1 },
    });
    const s2 = await searchQueueService.enqueue({
      instance: inst,
      action: "season",
      mediaId: 7,
      title: "S",
      payload: { seasonNumber: 2 },
    });
    expect(s2.id).not.toBe(s1.id);
    expect(await searchQueueService.listPending(inst.id)).toHaveLength(2);
  });

  test("enqueue dedupes the same season of the same series", async () => {
    const inst = await makeSonarrInstance();
    const a = await searchQueueService.enqueue({
      instance: inst,
      action: "season",
      mediaId: 7,
      title: "S",
      payload: { seasonNumber: 1 },
    });
    const b = await searchQueueService.enqueue({
      instance: inst,
      action: "season",
      mediaId: 7,
      title: "S",
      payload: { seasonNumber: 1 },
    });
    expect(b.id).toBe(a.id);
    expect(await searchQueueService.listPending(inst.id)).toHaveLength(1);
  });

  test("enqueue dedupes the same episode but allows distinct fileIds", async () => {
    const inst = await makeSonarrInstance();
    const a = await searchQueueService.enqueue({
      instance: inst,
      action: "episode",
      mediaId: 7,
      title: "E",
      payload: { fileId: 100 },
    });
    const dup = await searchQueueService.enqueue({
      instance: inst,
      action: "episode",
      mediaId: 7,
      title: "E",
      payload: { fileId: 100 },
    });
    expect(dup.id).toBe(a.id);

    const other = await searchQueueService.enqueue({
      instance: inst,
      action: "episode",
      mediaId: 7,
      title: "E",
      payload: { fileId: 101 },
    });
    expect(other.id).not.toBe(a.id);
    expect(await searchQueueService.listPending(inst.id)).toHaveLength(2);
  });

  test("getStatus reports pendingCount=0 and etaMs=0 when empty", async () => {
    const inst = await makeInstance();
    const status = await searchQueueService.getStatus(inst.id);
    expect(status).toEqual({ pendingCount: 0, etaMs: 0 });
  });

  test("getStatus computes eta from searchesPerHour and pending count", async () => {
    const inst = await makeInstance(20);
    await searchQueueService.enqueue({
      instance: inst,
      action: "movie",
      mediaId: 1,
      title: "a",
    });
    await searchQueueService.enqueue({
      instance: inst,
      action: "movie",
      mediaId: 2,
      title: "b",
    });
    await searchQueueService.enqueue({
      instance: inst,
      action: "movie",
      mediaId: 3,
      title: "c",
    });
    const status = await searchQueueService.getStatus(inst.id);
    expect(status.pendingCount).toBe(3);
    // 20/hour → 180_000ms per slot. 3 pending → first now, then 180s, then 360s.
    // ETA is for the LAST item: 2 * 180_000 = 360_000.
    expect(status.etaMs).toBe(360_000);
  });

  test("markDone and markFailed update the row terminal status", async () => {
    const inst = await makeInstance();
    const row = await searchQueueService.enqueue({
      instance: inst,
      action: "movie",
      mediaId: 1,
      title: "a",
    });
    await searchQueueService.markDone(row.id);
    expect(await searchQueueService.findNextPending(inst.id)).toBeNull();

    const row2 = await searchQueueService.enqueue({
      instance: inst,
      action: "movie",
      mediaId: 2,
      title: "b",
    });
    await searchQueueService.markFailed(row2.id, "upstream-503");
    expect(await searchQueueService.findNextPending(inst.id)).toBeNull();
  });

  test("listPending returns all pending rows for an instance", async () => {
    const inst = await makeInstance();
    await searchQueueService.enqueue({
      instance: inst,
      action: "movie",
      mediaId: 1,
      title: "a",
    });
    await searchQueueService.enqueue({
      instance: inst,
      action: "movie",
      mediaId: 2,
      title: "b",
    });
    const list = await searchQueueService.listPending(inst.id);
    expect(list).toHaveLength(2);
    expect(list.map((r) => r.title)).toEqual(["a", "b"]);
  });

  test("listAllPending returns rows across all instances", async () => {
    const a = await makeInstance();
    const b = await makeSonarrInstance();
    await searchQueueService.enqueue({
      instance: a,
      action: "movie",
      mediaId: 1,
      title: "a1",
    });
    await searchQueueService.enqueue({
      instance: b,
      action: "series",
      mediaId: 1,
      title: "b1",
    });
    const list = await searchQueueService.listAllPending();
    expect(list).toHaveLength(2);
  });

  test("clearPending removes only pending rows for the given instance", async () => {
    const a = await makeInstance();
    const b = await makeInstance();
    await searchQueueService.enqueue({
      instance: a,
      action: "movie",
      mediaId: 1,
      title: "a1",
    });
    await searchQueueService.enqueue({
      instance: a,
      action: "movie",
      mediaId: 2,
      title: "a2",
    });
    const otherRow = await searchQueueService.enqueue({
      instance: b,
      action: "movie",
      mediaId: 1,
      title: "b1",
    });
    await searchQueueService.markDone(otherRow.id); // terminal — should be untouched

    const removed = await searchQueueService.clearPending(a.id);
    expect(removed).toBe(2);
    expect(await searchQueueService.listPending(a.id)).toHaveLength(0);
    expect(await searchQueueService.listAllPending()).toHaveLength(0);
  });

  // Guard the (instance, action) pairing invariant. The new
  // `instance: Pick<Instance, "id" | "type">` shape on EnqueueInput
  // makes a mismatched arrType impossible structurally, but the
  // service ALSO performs a defensive check via `dedupKeyFor`: when
  // the resolved arr-type doesn't own the requested action, throw
  // before writing a row that would later fail at drain time. This
  // test pins that behavior so future regressions surface here.
  test("enqueue rejects an action the resolved arr-type doesn't own", async () => {
    const radarrInst = await makeInstance();
    await expect(
      searchQueueService.enqueue({
        instance: radarrInst, // type: "radarr"
        action: "season", // sonarr-only action
        mediaId: 1,
        title: "Mismatch",
        payload: { seasonNumber: 1 },
      }),
    ).rejects.toThrow(/does not handle queue action "season"/);
    expect(await searchQueueService.listPending(radarrInst.id)).toHaveLength(0);
  });
});
