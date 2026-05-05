import { describe, test, expect, beforeEach, vi } from "vitest";
import { searchWorker } from "@/server/lib/search-worker";
import { searchQueueService } from "@/server/services/SearchQueueService";
import { searchQueueRepository } from "@/server/repositories/SearchQueueRepository";
import { logRepository } from "@/server/repositories/LogRepository";
import { instanceService } from "@/server/services/InstanceService";
import {
  mswServer,
  http,
  HttpResponse,
  radarrHandlers,
  sonarrHandlers,
} from "@/test/msw";

const radarrBase = "http://192.168.1.10:7878";
const sonarrBase = "http://192.168.1.20:8989";

async function makeRadarr(searchesPerHour = 3600) {
  // 3600/hour = one search per second; tests stay fast.
  return instanceService.create({
    type: "radarr",
    name: "TR",
    url: radarrBase,
    apiKey: "abcd1234abcd1234abcd1234abcd1234",
    searchesPerHour,
  });
}

async function makeSonarr() {
  return instanceService.create({
    type: "sonarr",
    name: "TS",
    url: sonarrBase,
    apiKey: "abcd1234abcd1234abcd1234abcd1234",
    searchesPerHour: 3600,
  });
}

beforeEach(() => {
  searchWorker.stop();
});

describe("SearchWorker", () => {
  test("processes a pending movie search, writes an ActionLog row, marks queue done", async () => {
    const inst = await makeRadarr();
    const commands: Array<Record<string, unknown>> = [];
    mswServer.use(
      http.post(`${radarrBase}/api/v3/command`, async ({ request }) => {
        commands.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ id: 1 });
      }),
      ...radarrHandlers(
        { baseUrl: radarrBase },
        { movies: [], movieFiles: [], qualityProfiles: [] },
      ),
    );
    const queued = await searchQueueService.enqueue({
      instanceId: inst.id,
      action: "movie",
      mediaId: 42,
      title: "X",
    });

    await searchWorker.start();
    await vi.waitFor(
      async () => {
        const refetched = await searchQueueRepository.findById(queued.id);
        expect(refetched?.status).toBe("done");
      },
      { timeout: 2000 },
    );

    expect(commands.length).toBe(1);
    expect(commands[0].name).toBe("MoviesSearch");
    expect(commands[0].movieIds).toEqual([42]);

    // The worker must route through the service layer (not the raw client),
    // so an ActionLog row appears in History for every fired search.
    const logs = await logRepository.findAll();
    const ours = logs.filter((l) => l.instanceId === inst.id);
    expect(ours).toHaveLength(1);
    expect(ours[0].action).toBe("search");
    expect(ours[0].status).toBe("success");
    expect(ours[0].title).toBe("X");
  });

  test("processes a series search through SonarrClient", async () => {
    const inst = await makeSonarr();
    const commands: Array<Record<string, unknown>> = [];
    mswServer.use(
      http.post(`${sonarrBase}/api/v3/command`, async ({ request }) => {
        commands.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ id: 1 });
      }),
      ...sonarrHandlers({ baseUrl: sonarrBase }),
    );
    await searchQueueService.enqueue({
      instanceId: inst.id,
      action: "series",
      mediaId: 7,
      title: "Show",
    });

    await searchWorker.start();
    await vi.waitFor(() => expect(commands.length).toBe(1), { timeout: 2000 });
    expect(commands[0].name).toBe("SeriesSearch");
    expect(commands[0].seriesId).toBe(7);
  });

  test("season search payload reaches the upstream command body", async () => {
    const inst = await makeSonarr();
    const commands: Array<Record<string, unknown>> = [];
    mswServer.use(
      http.post(`${sonarrBase}/api/v3/command`, async ({ request }) => {
        commands.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ id: 1 });
      }),
      ...sonarrHandlers({ baseUrl: sonarrBase }),
    );
    await searchQueueService.enqueue({
      instanceId: inst.id,
      action: "season",
      mediaId: 7,
      title: "Show",
      payload: { seasonNumber: 3 },
    });

    await searchWorker.start();
    await vi.waitFor(() => expect(commands.length).toBe(1), { timeout: 2000 });
    expect(commands[0].name).toBe("SeasonSearch");
    expect(commands[0].seriesId).toBe(7);
    expect(commands[0].seasonNumber).toBe(3);
  });

  test("marks a queue row failed when upstream errors", async () => {
    const inst = await makeRadarr();
    mswServer.use(
      http.post(
        `${radarrBase}/api/v3/command`,
        () => new HttpResponse(null, { status: 500 }),
      ),
      ...radarrHandlers(
        { baseUrl: radarrBase },
        { movies: [], movieFiles: [], qualityProfiles: [] },
      ),
    );
    const queued = await searchQueueService.enqueue({
      instanceId: inst.id,
      action: "movie",
      mediaId: 1,
      title: "X",
    });

    await searchWorker.start();
    await vi.waitFor(
      async () => {
        const refetched = await searchQueueRepository.findById(queued.id);
        expect(refetched?.status).toBe("failed");
        expect(refetched?.error).toContain("500");
      },
      { timeout: 2000 },
    );
  });

  test("marks the row failed when the instance no longer exists mid-flight", async () => {
    // Start the worker FIRST so it registers a timer for this instance, then
    // delete the instance directly (bypassing instanceService.delete() which
    // now calls clearPending() and would remove the row before the timer fires).
    const inst = await makeRadarr();
    mswServer.use(...radarrHandlers({ baseUrl: radarrBase }));
    await searchWorker.start();

    const { prisma } = await import("@/server/lib/db");
    await prisma.instance.delete({ where: { id: inst.id } });

    const { entry: queued } = await searchQueueRepository.createUnique({
      instanceId: inst.id,
      action: "movie",
      mediaId: 1,
      payload: "{}",
      title: "Ghost",
      seasonNumber: 0,
      fileId: 0,
    });

    await vi.waitFor(
      async () => {
        const refetched = await searchQueueRepository.findById(queued.id);
        expect(refetched?.status).toBe("failed");
        expect(refetched?.error).toContain("Instance not found");
      },
      { timeout: 2000 },
    );
  });

  test("episode action resolves episodeIds via getEpisodes and posts EpisodeSearch", async () => {
    const inst = await makeSonarr();
    const commands: Array<Record<string, unknown>> = [];
    mswServer.use(
      http.post(`${sonarrBase}/api/v3/command`, async ({ request }) => {
        commands.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ id: 1 });
      }),
      http.get(`${sonarrBase}/api/v3/episode`, () =>
        HttpResponse.json([
          { id: 100, episodeFileId: 999, seasonNumber: 1, episodeNumber: 1 },
          { id: 101, episodeFileId: 42, seasonNumber: 1, episodeNumber: 2 },
          { id: 102, episodeFileId: 42, seasonNumber: 1, episodeNumber: 3 },
        ]),
      ),
      ...sonarrHandlers({ baseUrl: sonarrBase }),
    );
    await searchQueueService.enqueue({
      instanceId: inst.id,
      action: "episode",
      mediaId: 7,
      title: "Show — S01E02",
      payload: { fileId: 42 },
    });

    await searchWorker.start();
    await vi.waitFor(() => expect(commands.length).toBe(1), { timeout: 2000 });
    expect(commands[0].name).toBe("EpisodeSearch");
    expect(commands[0].episodeIds).toEqual([101, 102]);
  });

  test("worker marks the row failed when the instance disappears mid-flight", async () => {
    // Start worker FIRST so the setInterval is registered for this instance.
    // Then delete the row via prisma directly — the refresh path on the repo
    // would have stopped the timer, but a raw DB delete leaves the timer
    // running. Next tick finds the pending row, fails to look up the
    // instance, and routes through markFailed.
    const inst = await makeRadarr(); // 3600/hour → 1s interval
    await searchWorker.start();
    const { prisma } = await import("@/server/lib/db");
    await prisma.instance.delete({ where: { id: inst.id } });
    const queued = await searchQueueService.enqueue({
      instanceId: inst.id,
      action: "movie",
      mediaId: 1,
      title: "ghost",
    });

    await vi.waitFor(
      async () => {
        const refetched = await searchQueueRepository.findById(queued.id);
        expect(refetched?.status).toBe("failed");
        expect(refetched?.error).toMatch(/Instance not found/);
      },
      { timeout: 3000 },
    );
  });

  test("worker marks the row failed when the action is unknown", async () => {
    const inst = await makeRadarr();
    // Bypass enqueue() — the type system would reject an unknown action.
    // We're testing the worker's defensive throw against malformed rows.
    const { entry: queued } = await searchQueueRepository.createUnique({
      instanceId: inst.id,
      action: "bogus" as "movie",
      mediaId: 1,
      payload: "{}",
      title: "ghost",
      seasonNumber: 0,
      fileId: 0,
    });
    mswServer.use(...radarrHandlers({ baseUrl: radarrBase }));

    await searchWorker.start();
    await vi.waitFor(
      async () => {
        const refetched = await searchQueueRepository.findById(queued.id);
        expect(refetched?.status).toBe("failed");
        expect(refetched?.error).toMatch(/Unknown queue action/);
      },
      { timeout: 3000 },
    );
  });

  test("a follow-up enqueue after the queue empties drains immediately", async () => {
    // Regression for the empty-queue lastProcessedAt foot-gun: if the
    // worker stamped lastProcessedAt on a no-op tick, kick() would skip
    // until minDelayMs elapsed, leaving the new row stuck visibly.
    const inst = await makeRadarr(60); // 60/hour → 60s minDelay
    const commands: Array<Record<string, unknown>> = [];
    mswServer.use(
      http.post(`${radarrBase}/api/v3/command`, async ({ request }) => {
        commands.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ id: 1 });
      }),
      ...radarrHandlers(
        { baseUrl: radarrBase },
        { movies: [], movieFiles: [], qualityProfiles: [] },
      ),
    );

    await searchWorker.start();
    // First tick fires immediately on start() — queue is empty so it is
    // a no-op. The fix means lastProcessedAt is NOT stamped.
    await new Promise((r) => setTimeout(r, 50));
    expect(commands.length).toBe(0);

    // Now enqueue. enqueue() pokes kick(); since no real drain happened,
    // kick() should fire processOne immediately and dispatch this search.
    const enqueued = await searchQueueService.enqueue({
      instanceId: inst.id,
      action: "movie",
      mediaId: 7,
      title: "Late Arrival",
    });
    await vi.waitFor(
      async () => {
        const refetched = await searchQueueRepository.findById(enqueued.id);
        expect(refetched?.status).toBe("done");
      },
      { timeout: 2000 },
    );
    expect(commands.length).toBe(1);
  });
});
