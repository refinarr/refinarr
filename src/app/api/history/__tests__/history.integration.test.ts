import { describe, test, expect } from "vitest";
import { NextRequest } from "next/server";
import { logRepository } from "@/server/repositories/LogRepository";
import { instanceService } from "@/server/services/InstanceService";
import { http, HttpResponse, mswServer } from "@/test/msw";
import { GET, DELETE as clearAll } from "@/app/api/history/route";
import { POST as retry } from "@/app/api/history/[id]/retry/route";

const ctxNone = { params: Promise.resolve({}) };

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
  return new NextRequest(`http://localhost/api/history?${qs}`, {
    method: "GET",
  });
}

function retryReq(id: number) {
  return new NextRequest(`http://localhost/api/history/${id}/retry`, {
    method: "POST",
  });
}

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
    const res = await clearAll(
      new NextRequest("http://localhost/api/history", { method: "DELETE" }),
      ctxNone,
    );
    expect(res.status).toBe(200);
    expect(await logRepository.findAll()).toHaveLength(0);
  });
});

describe("POST /api/history/[id]/retry", () => {
  test("updates the selected failed log instead of creating a duplicate", async () => {
    const radarrBase = "http://192.168.1.10:7878";
    mswServer.use(
      http.post(
        `${radarrBase}/api/v3/command`,
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
    const instance = await instanceService.create({
      type: "radarr",
      name: "Test Radarr",
      url: radarrBase,
      apiKey: "abcd1234abcd1234abcd1234abcd1234",
    });
    const payload = {
      instanceId: instance.id,
      action: "search",
      mediaId: 100,
      title: "Movie",
    };
    const original = await logRepository.create({
      ...baseLog,
      instanceId: instance.id,
      status: "failed",
      error: "old failure",
      payload: JSON.stringify(payload),
    });
    const previousCreatedAt = new Date(Date.now() - 60_000);
    await logRepository.update(original.id, { createdAt: previousCreatedAt });

    const res = await retry(retryReq(original.id), {
      params: Promise.resolve({ id: String(original.id) }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ id: original.id, status: "failed" });
    const logs = await logRepository.findAll();
    expect(logs).toHaveLength(1);
    expect(logs[0].id).toBe(original.id);
    expect(logs[0].error).toBe("Test Radarr API error: 500");
    // The original failure timestamp survives; the retry is captured in
    // lastRetriedAt so the History UI can render "Failed X · Retried Y".
    expect(logs[0].createdAt.getTime()).toBe(previousCreatedAt.getTime());
    expect(logs[0].lastRetriedAt).toBeTruthy();
    expect(logs[0].lastRetriedAt!.getTime()).toBeGreaterThan(
      previousCreatedAt.getTime(),
    );
  });

  test("season-scoped retry preserves seasonNumber instead of broadening to a series search", async () => {
    const sonarrBase = "http://192.168.1.10:8989";
    mswServer.use(
      http.post(
        `${sonarrBase}/api/v3/command`,
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
    const instance = await instanceService.create({
      type: "sonarr",
      name: "Test Sonarr",
      url: sonarrBase,
      apiKey: "abcd1234abcd1234abcd1234abcd1234",
    });
    const payload = {
      instanceId: instance.id,
      action: "search_season",
      mediaId: 7,
      seasonNumber: 3,
      title: "Show",
    };
    const original = await logRepository.create({
      ...baseLog,
      instanceId: instance.id,
      action: "search_season",
      mediaId: 7,
      title: "Show",
      status: "failed",
      error: "old failure",
      payload: JSON.stringify(payload),
    });

    const res = await retry(retryReq(original.id), {
      params: Promise.resolve({ id: String(original.id) }),
    });
    expect(res.status).toBe(200);

    const logs = await logRepository.findAll();
    expect(logs).toHaveLength(1);
    expect(logs[0].id).toBe(original.id);
    // The action column and payload both stay scoped to the season variant
    // so future retries dispatch via the same registry handler.
    expect(logs[0].action).toBe("search_season");
    const rewritten = JSON.parse(logs[0].payload!);
    expect(rewritten.action).toBe("search_season");
    expect(rewritten.seasonNumber).toBe(3);
  });

  test("episode-scoped retry preserves fileId instead of broadening to a series search", async () => {
    const sonarrBase = "http://192.168.1.10:8989";
    mswServer.use(
      http.get(`${sonarrBase}/api/v3/episode`, () =>
        HttpResponse.json([
          { id: 1, episodeFileId: 42, seasonNumber: 1, episodeNumber: 2 },
        ]),
      ),
      http.post(
        `${sonarrBase}/api/v3/command`,
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
    const instance = await instanceService.create({
      type: "sonarr",
      name: "Test Sonarr",
      url: sonarrBase,
      apiKey: "abcd1234abcd1234abcd1234abcd1234",
    });
    const payload = {
      instanceId: instance.id,
      action: "search_episode",
      mediaId: 7,
      fileId: 42,
      title: "Show",
    };
    const original = await logRepository.create({
      ...baseLog,
      instanceId: instance.id,
      action: "search_episode",
      mediaId: 7,
      title: "Show",
      status: "failed",
      error: "old failure",
      payload: JSON.stringify(payload),
    });

    const res = await retry(retryReq(original.id), {
      params: Promise.resolve({ id: String(original.id) }),
    });
    expect(res.status).toBe(200);

    const logs = await logRepository.findAll();
    expect(logs).toHaveLength(1);
    expect(logs[0].id).toBe(original.id);
    expect(logs[0].action).toBe("search_episode");
    const rewritten = JSON.parse(logs[0].payload!);
    expect(rewritten.action).toBe("search_episode");
    expect(rewritten.fileId).toBe(42);
  });

  test("rejects retry when stored payload does not match the log row's instance/media", async () => {
    const instance = await instanceService.create({
      type: "radarr",
      name: "Test Radarr",
      url: "http://192.168.1.10:7878",
      apiKey: "abcd1234abcd1234abcd1234abcd1234",
    });
    // Row says (instanceId, mediaId) = (instance.id, 100), payload disagrees.
    const corrupt = await logRepository.create({
      ...baseLog,
      instanceId: instance.id,
      mediaId: 100,
      status: "failed",
      payload: JSON.stringify({
        instanceId: 9999,
        action: "search",
        mediaId: 8888,
        title: "Mismatch",
      }),
    });
    const res = await retry(retryReq(corrupt.id), {
      params: Promise.resolve({ id: String(corrupt.id) }),
    });
    expect(res.status).toBe(400);
    // The original row is untouched.
    const fresh = await logRepository.findById(corrupt.id);
    expect(fresh?.status).toBe("failed");
  });

  test("returns 400 (not 500) when the action is not retryable", async () => {
    const instance = await instanceService.create({
      type: "radarr",
      name: "Test Radarr",
      url: "http://192.168.1.10:7878",
      apiKey: "abcd1234abcd1234abcd1234abcd1234",
    });
    // "ignore" isn't in MovieService's retry registry; the service throws
    // RetryNotSupportedError, the route maps that to a 400 with the
    // descriptive message instead of leaking a generic 500.
    const corrupt = await logRepository.create({
      ...baseLog,
      instanceId: instance.id,
      action: "ignore",
      mediaId: 100,
      status: "failed",
      payload: JSON.stringify({
        instanceId: instance.id,
        action: "ignore",
        mediaId: 100,
        title: "Movie",
      }),
    });
    const res = await retry(retryReq(corrupt.id), {
      params: Promise.resolve({ id: String(corrupt.id) }),
    });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Cannot retry/);
  });

  test("rejects retry when payload action differs from the log row's action", async () => {
    const instance = await instanceService.create({
      type: "radarr",
      name: "Test Radarr",
      url: "http://192.168.1.10:7878",
      apiKey: "abcd1234abcd1234abcd1234abcd1234",
    });
    // IDs match but the actions disagree — without this guard the row would
    // be updated in-place against the wrong operation type.
    const corrupt = await logRepository.create({
      ...baseLog,
      instanceId: instance.id,
      mediaId: 100,
      action: "search",
      status: "failed",
      payload: JSON.stringify({
        instanceId: instance.id,
        action: "delete",
        mediaId: 100,
        fileId: 5,
        title: "Movie",
      }),
    });
    const res = await retry(retryReq(corrupt.id), {
      params: Promise.resolve({ id: String(corrupt.id) }),
    });
    expect(res.status).toBe(400);
    const fresh = await logRepository.findById(corrupt.id);
    expect(fresh?.status).toBe("failed");
    expect(fresh?.action).toBe("search");
  });
});
