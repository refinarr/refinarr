import { afterEach, describe, test, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, DELETE as clearAll } from "@/app/api/history/route";
import { POST as retry } from "@/app/api/history/[id]/retry/route";
import { logRepository } from "@/server/repositories/LogRepository";
import { instanceService } from "@/server/services/InstanceService";

const ctxNone = { params: Promise.resolve({}) };
const fetchMock = vi.fn();

const baseLog = {
  instanceId: 1,
  action: "search" as const,
  mediaId: 100,
  title: "Movie",
  isDryRun: false,
  status: "success" as const,
  error: null,
  payload: null,
};

function getReq(qs: string) {
  return new NextRequest(`http://localhost/api/history?${qs}`, { method: "GET" });
}

function retryReq(id: number) {
  return new NextRequest(`http://localhost/api/history/${id}/retry`, { method: "POST" });
}

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe("GET /api/history", () => {
  test("returns paginated wrapped shape", async () => {
    for (let i = 0; i < 3; i += 1) {
      await logRepository.create({ ...baseLog, mediaId: i });
    }
    const res = await GET(getReq("page=1&limit=50"), ctxNone);
    const body = await res.json();
    expect(body.items).toHaveLength(3);
    expect(body.total).toBe(3);
    expect(body.hasMore).toBe(false);
  });

  test("hasMore is true when more pages exist", async () => {
    // ACTION_LOG_RETENTION_CAP=5 in tests, so the trim caps the rows. Insert
    // exactly 4 to keep them all and still have a partial second page.
    for (let i = 0; i < 4; i += 1) {
      await logRepository.create({ ...baseLog, mediaId: i });
    }
    const res = await GET(getReq("page=1&limit=2"), ctxNone);
    const body = await res.json();
    expect(body.items).toHaveLength(2);
    expect(body.total).toBe(4);
    expect(body.hasMore).toBe(true);
  });

  test("filter by status returns only matching rows", async () => {
    await logRepository.create({ ...baseLog, status: "success" });
    await logRepository.create({ ...baseLog, status: "failed", error: "boom" });
    const res = await GET(getReq("status=failed"), ctxNone);
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.items[0].status).toBe("failed");
  });

  test("filter by instanceId scopes results", async () => {
    await logRepository.create({ ...baseLog, instanceId: 1 });
    await logRepository.create({ ...baseLog, instanceId: 2 });
    const res = await GET(getReq("instanceId=1"), ctxNone);
    const body = await res.json();
    expect(body.total).toBe(1);
  });
});

describe("DELETE /api/history", () => {
  test("clears all action log rows", async () => {
    await logRepository.create(baseLog);
    await logRepository.create(baseLog);
    const res = await clearAll(new NextRequest("http://localhost/api/history", { method: "DELETE" }), ctxNone);
    expect(res.status).toBe(200);
    expect(await logRepository.findAll()).toHaveLength(0);
  });
});

describe("POST /api/history/[id]/retry", () => {
  test("updates the selected failed log instead of creating a duplicate", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(new Response("nope", { status: 500 }));
    const instance = await instanceService.create({
      type: "radarr",
      name: "Test Radarr",
      url: "http://192.168.1.10:7878",
      apiKey: "abcd1234abcd1234abcd1234abcd1234",
    });
    const payload = { instanceId: instance.id, action: "search", mediaId: 100, title: "Movie" };
    const original = await logRepository.create({
      ...baseLog,
      instanceId: instance.id,
      status: "failed",
      error: "old failure",
      payload: JSON.stringify(payload),
    });
    const previousCreatedAt = new Date(Date.now() - 60_000);
    await logRepository.update(original.id, { createdAt: previousCreatedAt });

    const res = await retry(retryReq(original.id), { params: Promise.resolve({ id: String(original.id) }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ id: original.id, status: "failed" });
    const logs = await logRepository.findAll();
    expect(logs).toHaveLength(1);
    expect(logs[0].id).toBe(original.id);
    expect(logs[0].error).toBe("Test Radarr API error: 500");
    expect(logs[0].createdAt.getTime()).toBeGreaterThan(previousCreatedAt.getTime());
  });

  test("season-scoped retry preserves seasonNumber instead of broadening to a series search", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(new Response("nope", { status: 500 }));
    const instance = await instanceService.create({
      type: "sonarr",
      name: "Test Sonarr",
      url: "http://192.168.1.10:8989",
      apiKey: "abcd1234abcd1234abcd1234abcd1234",
    });
    const payload = {
      instanceId: instance.id, action: "search", mediaId: 7, seasonNumber: 3, title: "Show",
    };
    const original = await logRepository.create({
      ...baseLog,
      instanceId: instance.id,
      mediaId: 7,
      title: "Show",
      status: "failed",
      error: "old failure",
      payload: JSON.stringify(payload),
    });

    const res = await retry(retryReq(original.id), { params: Promise.resolve({ id: String(original.id) }) });
    expect(res.status).toBe(200);

    const logs = await logRepository.findAll();
    expect(logs).toHaveLength(1);
    expect(logs[0].id).toBe(original.id);
    // The row's payload must keep seasonNumber so future retries stay scoped.
    const rewritten = JSON.parse(logs[0].payload!);
    expect(rewritten.seasonNumber).toBe(3);
  });
});
