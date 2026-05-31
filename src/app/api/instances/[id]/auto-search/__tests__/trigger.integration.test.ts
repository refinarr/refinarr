import { describe, test, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { autoRunner } from "@/server/lib/auto-runner";
import { instanceService } from "@/server/services/InstanceService";
import { searchQueueRepository } from "@/server/repositories/SearchQueueRepository";
import { searchQueueService } from "@/server/services/SearchQueueService";
import {
  mswServer,
  http,
  HttpResponse,
  radarrHandlers,
  sonarrHandlers,
} from "@/test/msw";
import { POST as triggerPost } from "@/app/api/instances/[id]/auto-search/trigger/route";
import { POST as postInstance } from "@/app/api/instances/route";

const radarrBase = "http://192.168.1.20:7878";
const sonarrBase = "http://192.168.1.20:8989";

const ctxFor = (id: number) => ({
  params: Promise.resolve({ id: String(id) }),
});

function triggerReq(id: number) {
  return new NextRequest(
    `http://localhost/api/instances/${id}/auto-search/trigger`,
    { method: "POST" },
  );
}

function postReq(body: unknown) {
  return new NextRequest("http://localhost/api/instances", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const baseRadarr = {
  type: "radarr" as const,
  name: "Test Radarr",
  url: radarrBase,
  apiKey: "abcd1234abcd1234abcd1234abcd1234",
};

const baseSonarr = {
  type: "sonarr" as const,
  name: "Test Sonarr",
  url: sonarrBase,
  apiKey: "abcd1234abcd1234abcd1234abcd1234",
};

// Profile with cutoff=100 — movies with customFormatScore < 100 are flagged.
const profile = {
  id: 1,
  name: "HD",
  cutoff: 1,
  cutoffFormatScore: 100,
  minUpgradeFormatScore: 1,
  formatItems: [],
  items: [],
};

function movie(
  id: number,
  overrides: {
    hasFile?: boolean;
    monitored?: boolean;
    customFormatScore?: number;
    movieFile?: {
      id: number;
      customFormats: unknown[];
      customFormatScore: number;
    } | null;
  } = {},
) {
  return {
    id,
    title: `Movie ${id}`,
    qualityProfileId: 1,
    customFormats: [],
    customFormatScore: overrides.customFormatScore ?? 0,
    hasFile: overrides.hasFile ?? false,
    monitored: overrides.monitored ?? true,
    movieFile: overrides.movieFile ?? null,
    ...overrides,
  };
}

// ─── Mocked dispatch tests ──────────────────────────────────────────────────

describe("POST /api/instances/[id]/auto-search/trigger — mocked dispatch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("returns 404 for unknown instance", async () => {
    const res = await triggerPost(triggerReq(99999), ctxFor(99999));
    expect(res.status).toBe(404);
  });

  test("returns 409 AUTO_RUN_INELIGIBLE when autoSearchEnabled=false", async () => {
    const created = await postInstance(
      postReq({ ...baseRadarr, autoSearchEnabled: false }),
      { params: Promise.resolve({}) },
    );
    const { id } = await created.json();

    const res = await triggerPost(triggerReq(id), ctxFor(id));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("AUTO_RUN_INELIGIBLE");
    await instanceService.delete(id);
  });

  test("returns 409 AUTO_RUN_BUSY when already processing", async () => {
    const created = await postInstance(
      postReq({ ...baseRadarr, autoSearchEnabled: true }),
      { params: Promise.resolve({}) },
    );
    const { id } = await created.json();

    vi.spyOn(autoRunner, "runNow").mockRejectedValueOnce(
      Object.assign(new Error("busy"), { code: "AUTO_RUN_BUSY" }),
    );
    const res = await triggerPost(triggerReq(id), ctxFor(id));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("AUTO_RUN_BUSY");
    await instanceService.delete(id);
  });

  test("returns { enqueued: N } on success", async () => {
    const created = await postInstance(
      postReq({ ...baseRadarr, autoSearchEnabled: true }),
      { params: Promise.resolve({}) },
    );
    const { id } = await created.json();

    vi.spyOn(autoRunner, "runNow").mockResolvedValueOnce({ enqueued: 3 });
    const res = await triggerPost(triggerReq(id), ctxFor(id));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enqueued).toBe(3);
    await instanceService.delete(id);
  });
});

// ─── Real dispatch tests (MSW-backed) ───────────────────────────────────────

describe("POST /api/instances/[id]/auto-search/trigger — real dispatch", () => {
  beforeEach(async () => {
    await autoRunner.stop();
  });

  // ── Scope filter tests ───────────────────────────────────────────────────

  test("scope=all: all movies are candidates, regardless of flagging", async () => {
    const movies = [
      movie(1, { customFormatScore: 0 }), // flagged
      movie(2, { customFormatScore: 0 }), // flagged
      movie(3, { customFormatScore: 100 }), // not flagged — still eligible for scope=all
    ];
    mswServer.use(
      ...radarrHandlers(
        { baseUrl: radarrBase },
        { movies, movieFiles: [], qualityProfiles: [profile] },
      ),
    );
    const created = await postInstance(
      postReq({
        ...baseRadarr,
        autoSearchEnabled: true,
        autoSearchScope: "all",
        autoSearchMonitoredOnly: false,
        autoSearchBatchLimit: 10,
      }),
      { params: Promise.resolve({}) },
    );
    const { id } = await created.json();

    const res = await triggerPost(triggerReq(id), ctxFor(id));
    expect(res.status).toBe(200);
    const { enqueued } = await res.json();
    // All 3 are candidates under scope=all.
    expect(enqueued).toBe(3);
    await instanceService.delete(id);
  });

  test("scope=flagged: only movies below cutoff are candidates", async () => {
    // MovieService reads cfScore from the /moviefile endpoint (keyed by movieId),
    // not from the embedded movie-level customFormatScore. So a non-flagged movie
    // needs hasFile=true + a movieFile with customFormatScore >= cutoffFormatScore.
    const movies = [
      movie(1), // hasFile=false → cfScore=0 → flagged
      movie(2), // hasFile=false → cfScore=0 → flagged
      { ...movie(3), hasFile: true, movieFileId: 103 }, // movieFile score=100 → NOT flagged
    ];
    const movieFiles = [
      { id: 103, movieId: 3, customFormatScore: 100, customFormats: [] },
    ];
    mswServer.use(
      ...radarrHandlers(
        { baseUrl: radarrBase },
        { movies, movieFiles, qualityProfiles: [profile] },
      ),
    );
    const created = await postInstance(
      postReq({
        ...baseRadarr,
        autoSearchEnabled: true,
        autoSearchScope: "flagged",
        autoSearchMonitoredOnly: false,
        autoSearchBatchLimit: 10,
      }),
      { params: Promise.resolve({}) },
    );
    const { id } = await created.json();

    const res = await triggerPost(triggerReq(id), ctxFor(id));
    const { enqueued } = await res.json();
    // Movies 1 and 2 have no file → cfScore=0 → flagged; movie 3 has file score 100 = cutoff → not flagged.
    expect(enqueued).toBe(2);
    await instanceService.delete(id);
  });

  test("scope=missing + monitoredOnly=true: only monitored movies without files", async () => {
    const movies = [
      movie(1, { hasFile: false, monitored: true }), // missing + monitored → candidate
      movie(2, { hasFile: true, monitored: true }), // has file → not missing → excluded
      movie(3, { hasFile: false, monitored: false }), // no file but unmonitored → excluded
    ];
    mswServer.use(
      ...radarrHandlers(
        { baseUrl: radarrBase },
        { movies, movieFiles: [], qualityProfiles: [profile] },
      ),
    );
    const created = await postInstance(
      postReq({
        ...baseRadarr,
        autoSearchEnabled: true,
        autoSearchScope: "missing",
        autoSearchMonitoredOnly: true, // monitoredOnly=true excludes movie 3
        autoSearchBatchLimit: 10,
      }),
      { params: Promise.resolve({}) },
    );
    const { id } = await created.json();

    const res = await triggerPost(triggerReq(id), ctxFor(id));
    const { enqueued } = await res.json();
    expect(enqueued).toBe(1);
    const rows = await searchQueueRepository.findPendingByInstance(id);
    expect(rows[0].mediaId).toBe(1);
    await instanceService.delete(id);
  });

  test("scope=missing + monitoredOnly=false: movies without files (monitored or not) are candidates", async () => {
    // With monitoredOnly=false, the missing scope translates to
    // severities:["missing"] which only checks existingFileCount === 0,
    // not the monitored flag — unmonitored items with no file are still
    // "missing".
    const movies = [
      movie(1, { hasFile: false, monitored: true }), // missing
      movie(2, { hasFile: true, monitored: true }), // not missing
      movie(3, { hasFile: false, monitored: false }), // also missing (no file) even unmonitored
    ];
    mswServer.use(
      ...radarrHandlers(
        { baseUrl: radarrBase },
        { movies, movieFiles: [], qualityProfiles: [profile] },
      ),
    );
    const created = await postInstance(
      postReq({
        ...baseRadarr,
        autoSearchEnabled: true,
        autoSearchScope: "missing",
        autoSearchMonitoredOnly: false,
        autoSearchBatchLimit: 10,
      }),
      { params: Promise.resolve({}) },
    );
    const { id } = await created.json();

    const res = await triggerPost(triggerReq(id), ctxFor(id));
    const { enqueued } = await res.json();
    // Both movie 1 and movie 3 lack a file → 2 missing items.
    expect(enqueued).toBe(2);
    await instanceService.delete(id);
  });

  test("scope=upgrade: only movies with existing files are candidates", async () => {
    const movies = [
      movie(1, { hasFile: true }), // has file → upgrade candidate
      movie(2, { hasFile: true }), // has file → upgrade candidate
      movie(3, { hasFile: false }), // no file → excluded from upgrade scope
    ];
    mswServer.use(
      ...radarrHandlers(
        { baseUrl: radarrBase },
        { movies, movieFiles: [], qualityProfiles: [profile] },
      ),
    );
    const created = await postInstance(
      postReq({
        ...baseRadarr,
        autoSearchEnabled: true,
        autoSearchScope: "upgrade",
        autoSearchMonitoredOnly: false,
        autoSearchBatchLimit: 10,
      }),
      { params: Promise.resolve({}) },
    );
    const { id } = await created.json();

    const res = await triggerPost(triggerReq(id), ctxFor(id));
    const { enqueued } = await res.json();
    expect(enqueued).toBe(2);

    const rows = await searchQueueRepository.findPendingByInstance(id);
    const mediaIds = rows.map((r) => r.mediaId).sort();
    expect(mediaIds).toEqual([1, 2]);
    await instanceService.delete(id);
  });

  // ── Batch limit tests ────────────────────────────────────────────────────

  test("batchLimit=0: nothing is enqueued", async () => {
    const movies = [movie(1), movie(2), movie(3)];
    mswServer.use(
      ...radarrHandlers(
        { baseUrl: radarrBase },
        { movies, movieFiles: [], qualityProfiles: [profile] },
      ),
    );
    const created = await postInstance(
      postReq({
        ...baseRadarr,
        autoSearchEnabled: true,
        autoSearchScope: "all",
        autoSearchMonitoredOnly: false,
        autoSearchBatchLimit: 0,
      }),
      { params: Promise.resolve({}) },
    );
    const { id } = await created.json();

    const res = await triggerPost(triggerReq(id), ctxFor(id));
    const { enqueued } = await res.json();
    expect(enqueued).toBe(0);
    expect(await searchQueueRepository.findPendingByInstance(id)).toHaveLength(
      0,
    );
    await instanceService.delete(id);
  });

  test("batchLimit=2 of 5 items: exactly 2 enqueued", async () => {
    const movies = Array.from({ length: 5 }, (_, i) => movie(i + 1));
    mswServer.use(
      ...radarrHandlers(
        { baseUrl: radarrBase },
        { movies, movieFiles: [], qualityProfiles: [profile] },
      ),
    );
    const created = await postInstance(
      postReq({
        ...baseRadarr,
        autoSearchEnabled: true,
        autoSearchScope: "all",
        autoSearchMonitoredOnly: false,
        autoSearchBatchLimit: 2,
      }),
      { params: Promise.resolve({}) },
    );
    const { id } = await created.json();

    const res = await triggerPost(triggerReq(id), ctxFor(id));
    const { enqueued } = await res.json();
    expect(enqueued).toBe(2);
    expect(await searchQueueRepository.findPendingByInstance(id)).toHaveLength(
      2,
    );
    await instanceService.delete(id);
  });

  // ── groupId tests ────────────────────────────────────────────────────────

  test("batch > 1: all queue rows share the same groupId", async () => {
    const movies = [movie(1), movie(2), movie(3)];
    mswServer.use(
      ...radarrHandlers(
        { baseUrl: radarrBase },
        { movies, movieFiles: [], qualityProfiles: [profile] },
      ),
    );
    const created = await postInstance(
      postReq({
        ...baseRadarr,
        autoSearchEnabled: true,
        autoSearchScope: "all",
        autoSearchMonitoredOnly: false,
        autoSearchBatchLimit: 3,
      }),
      { params: Promise.resolve({}) },
    );
    const { id } = await created.json();

    await triggerPost(triggerReq(id), ctxFor(id));
    const rows = await searchQueueRepository.findPendingByInstance(id);
    expect(rows).toHaveLength(3);
    const groupId = rows[0].groupId;
    expect(groupId).not.toBeNull();
    // All rows must share the same groupId.
    for (const row of rows) expect(row.groupId).toBe(groupId);
    await instanceService.delete(id);
  });

  test("batch = 1: queue row has no groupId", async () => {
    const movies = [movie(1)];
    mswServer.use(
      ...radarrHandlers(
        { baseUrl: radarrBase },
        { movies, movieFiles: [], qualityProfiles: [profile] },
      ),
    );
    const created = await postInstance(
      postReq({
        ...baseRadarr,
        autoSearchEnabled: true,
        autoSearchScope: "all",
        autoSearchMonitoredOnly: false,
        autoSearchBatchLimit: 1,
      }),
      { params: Promise.resolve({}) },
    );
    const { id } = await created.json();

    await triggerPost(triggerReq(id), ctxFor(id));
    const rows = await searchQueueRepository.findPendingByInstance(id);
    expect(rows).toHaveLength(1);
    expect(rows[0].groupId).toBeNull();
    await instanceService.delete(id);
  });

  // ── Monitored filter tests ───────────────────────────────────────────────

  test("monitoredOnly=true: unmonitored movies are excluded", async () => {
    const movies = [
      movie(1, { monitored: true }),
      movie(2, { monitored: false }), // excluded
    ];
    mswServer.use(
      ...radarrHandlers(
        { baseUrl: radarrBase },
        { movies, movieFiles: [], qualityProfiles: [profile] },
      ),
    );
    const created = await postInstance(
      postReq({
        ...baseRadarr,
        autoSearchEnabled: true,
        autoSearchScope: "all",
        autoSearchMonitoredOnly: true,
        autoSearchBatchLimit: 10,
      }),
      { params: Promise.resolve({}) },
    );
    const { id } = await created.json();

    const res = await triggerPost(triggerReq(id), ctxFor(id));
    const { enqueued } = await res.json();
    expect(enqueued).toBe(1);
    const rows = await searchQueueRepository.findPendingByInstance(id);
    expect(rows[0].mediaId).toBe(1);
    await instanceService.delete(id);
  });

  test("monitoredOnly=false: unmonitored movies are included", async () => {
    const movies = [
      movie(1, { monitored: true }),
      movie(2, { monitored: false }),
    ];
    mswServer.use(
      ...radarrHandlers(
        { baseUrl: radarrBase },
        { movies, movieFiles: [], qualityProfiles: [profile] },
      ),
    );
    const created = await postInstance(
      postReq({
        ...baseRadarr,
        autoSearchEnabled: true,
        autoSearchScope: "all",
        autoSearchMonitoredOnly: false,
        autoSearchBatchLimit: 10,
      }),
      { params: Promise.resolve({}) },
    );
    const { id } = await created.json();

    const res = await triggerPost(triggerReq(id), ctxFor(id));
    const { enqueued } = await res.json();
    expect(enqueued).toBe(2);
    await instanceService.delete(id);
  });

  // ── Deduplication ────────────────────────────────────────────────────────

  test("item already pending in queue is not re-enqueued", async () => {
    const movies = [movie(1), movie(2)];
    mswServer.use(
      ...radarrHandlers(
        { baseUrl: radarrBase },
        { movies, movieFiles: [], qualityProfiles: [profile] },
      ),
    );
    const created = await postInstance(
      postReq({
        ...baseRadarr,
        autoSearchEnabled: true,
        autoSearchScope: "all",
        autoSearchMonitoredOnly: false,
        autoSearchBatchLimit: 10,
      }),
      { params: Promise.resolve({}) },
    );
    const { id } = await created.json();

    // Pre-seed movie 1 as pending.
    await searchQueueService.enqueue({
      instance: { id, type: "radarr" },
      action: "movie",
      mediaId: 1,
      title: "Movie 1",
    });

    const res = await triggerPost(triggerReq(id), ctxFor(id));
    const { enqueued } = await res.json();
    // Only movie 2 should be newly enqueued; movie 1 already pending.
    expect(enqueued).toBe(1);
    const rows = await searchQueueRepository.findPendingByInstance(id);
    // Still exactly 2 rows (1 seeded + 1 new).
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.mediaId).sort()).toEqual([1, 2]);
    await instanceService.delete(id);
  });

  test("second identical trigger run: all already pending → enqueued=0", async () => {
    const movies = [movie(1), movie(2)];
    mswServer.use(
      ...radarrHandlers(
        { baseUrl: radarrBase },
        { movies, movieFiles: [], qualityProfiles: [profile] },
      ),
    );
    const created = await postInstance(
      postReq({
        ...baseRadarr,
        autoSearchEnabled: true,
        autoSearchScope: "all",
        autoSearchMonitoredOnly: false,
        autoSearchBatchLimit: 10,
      }),
      { params: Promise.resolve({}) },
    );
    const { id } = await created.json();

    // First run.
    await triggerPost(triggerReq(id), ctxFor(id));
    // Second run — both items are now pending.
    const res2 = await triggerPost(triggerReq(id), ctxFor(id));
    const { enqueued } = await res2.json();
    expect(enqueued).toBe(0);
    // Queue still has exactly 2 rows — no duplicates added.
    expect(await searchQueueRepository.findPendingByInstance(id)).toHaveLength(
      2,
    );
    await instanceService.delete(id);
  });

  // ── Sonarr instance ──────────────────────────────────────────────────────

  test("sonarr instance: enqueued rows carry action=series", async () => {
    const series = [
      {
        id: 1,
        title: "Show 1",
        qualityProfileId: 1,
        customFormats: [],
        customFormatScore: 0,
        monitored: true,
        statistics: { episodeFileCount: 0, episodeCount: 5, sizeOnDisk: 0 },
        seasons: [],
      },
    ];
    mswServer.use(
      ...sonarrHandlers(
        { baseUrl: sonarrBase },
        {
          series,
          episodeFilesByseriesId: new Map([[1, []]]),
          qualityProfiles: [profile],
        },
      ),
    );
    const created = await postInstance(
      postReq({
        ...baseSonarr,
        autoSearchEnabled: true,
        autoSearchScope: "all",
        autoSearchMonitoredOnly: false,
        autoSearchBatchLimit: 10,
      }),
      { params: Promise.resolve({}) },
    );
    const { id } = await created.json();

    await triggerPost(triggerReq(id), ctxFor(id));
    const rows = await searchQueueRepository.findPendingByInstance(id);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    for (const row of rows) expect(row.action).toBe("series");
    await instanceService.delete(id);
  });

  // ── Pick strategy tests ──────────────────────────────────────────────────

  test("pickStrategy=balanced: picks oldest-searched items first", async () => {
    const movies = Array.from({ length: 5 }, (_, i) => movie(i + 1));
    mswServer.use(
      ...radarrHandlers(
        { baseUrl: radarrBase },
        { movies, movieFiles: [], qualityProfiles: [profile] },
      ),
    );
    const created = await postInstance(
      postReq({
        ...baseRadarr,
        autoSearchEnabled: true,
        autoSearchScope: "all",
        autoSearchMonitoredOnly: false,
        autoSearchBatchLimit: 3,
        autoSearchPickStrategy: "balanced",
      }),
      { params: Promise.resolve({}) },
    );
    const { id } = await created.json();

    const res = await triggerPost(triggerReq(id), ctxFor(id));
    const { enqueued } = await res.json();
    // balanced: never-searched items come first (backfill), sliced to batchLimit=3
    expect(enqueued).toBe(3);
    expect(await searchQueueRepository.findPendingByInstance(id)).toHaveLength(
      3,
    );
    await instanceService.delete(id);
  });

  test("pickStrategy=random: returns a valid subset of candidates", async () => {
    const movies = Array.from({ length: 10 }, (_, i) => movie(i + 1));
    mswServer.use(
      ...radarrHandlers(
        { baseUrl: radarrBase },
        { movies, movieFiles: [], qualityProfiles: [profile] },
      ),
    );
    const created = await postInstance(
      postReq({
        ...baseRadarr,
        autoSearchEnabled: true,
        autoSearchScope: "all",
        autoSearchMonitoredOnly: false,
        autoSearchBatchLimit: 4,
        autoSearchPickStrategy: "random",
      }),
      { params: Promise.resolve({}) },
    );
    const { id } = await created.json();

    const res = await triggerPost(triggerReq(id), ctxFor(id));
    const { enqueued } = await res.json();
    expect(enqueued).toBe(4);
    const rows = await searchQueueRepository.findPendingByInstance(id);
    expect(rows).toHaveLength(4);
    // Every enqueued mediaId must be one of the original 10.
    const validIds = new Set(movies.map((m) => m.id));
    for (const row of rows) expect(validIds.has(row.mediaId)).toBe(true);
    await instanceService.delete(id);
  });

  // ── Zero candidates ──────────────────────────────────────────────────────

  test("zero eligible items: enqueued=0, queue stays empty", async () => {
    // scope=missing but all movies have files → no missing items.
    const movies = [movie(1, { hasFile: true }), movie(2, { hasFile: true })];
    mswServer.use(
      ...radarrHandlers(
        { baseUrl: radarrBase },
        { movies, movieFiles: [], qualityProfiles: [profile] },
      ),
    );
    const created = await postInstance(
      postReq({
        ...baseRadarr,
        autoSearchEnabled: true,
        autoSearchScope: "missing",
        autoSearchMonitoredOnly: false,
        autoSearchBatchLimit: 10,
      }),
      { params: Promise.resolve({}) },
    );
    const { id } = await created.json();

    const res = await triggerPost(triggerReq(id), ctxFor(id));
    expect(res.status).toBe(200);
    const { enqueued } = await res.json();
    expect(enqueued).toBe(0);
    expect(await searchQueueRepository.findPendingByInstance(id)).toHaveLength(
      0,
    );
    await instanceService.delete(id);
  });

  test("instance with no movies at all: enqueued=0", async () => {
    mswServer.use(
      ...radarrHandlers(
        { baseUrl: radarrBase },
        { movies: [], movieFiles: [], qualityProfiles: [profile] },
      ),
    );
    const created = await postInstance(
      postReq({
        ...baseRadarr,
        autoSearchEnabled: true,
        autoSearchScope: "all",
        autoSearchMonitoredOnly: false,
        autoSearchBatchLimit: 10,
      }),
      { params: Promise.resolve({}) },
    );
    const { id } = await created.json();

    const res = await triggerPost(triggerReq(id), ctxFor(id));
    expect((await res.json()).enqueued).toBe(0);
    await instanceService.delete(id);
  });

  // ── Upstream failure ─────────────────────────────────────────────────────

  test("upstream arr unreachable: trigger returns 502", async () => {
    // No MSW handler registered → mswServer's onUnhandledRequest="error"
    // causes the fetch to throw, which the runner catches.
    // Actually the runner catches internally and returns enqueued=0 rather
    // than re-throwing. Verify 500 only if we truly let it propagate.
    // Instead: verify enqueued=0 and queue is empty when upstream is down.
    mswServer.use(
      http.get(
        `${radarrBase}/api/v3/movie`,
        () => new HttpResponse(null, { status: 503 }),
      ),
      ...radarrHandlers(
        { baseUrl: radarrBase },
        { movieFiles: [], qualityProfiles: [profile] },
      ),
    );
    const created = await postInstance(
      postReq({
        ...baseRadarr,
        autoSearchEnabled: true,
        autoSearchScope: "all",
        autoSearchMonitoredOnly: false,
        autoSearchBatchLimit: 10,
      }),
      { params: Promise.resolve({}) },
    );
    const { id } = await created.json();

    const res = await triggerPost(triggerReq(id), ctxFor(id));
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({
      code: "ARR_UNREACHABLE",
      error: "Upstream Arr unreachable",
    });
    expect(await searchQueueRepository.findPendingByInstance(id)).toHaveLength(
      0,
    );
    await instanceService.delete(id);
  });
});
