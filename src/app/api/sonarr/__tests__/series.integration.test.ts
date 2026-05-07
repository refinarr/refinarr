import { describe, test, expect } from "vitest";
import { NextRequest } from "next/server";
import { preferenceRepository } from "@/server/repositories/PreferenceRepository";
import { searchQueueRepository } from "@/server/repositories/SearchQueueRepository";
import { GET as listSeries } from "@/app/api/sonarr/series/route";
import { POST as searchSeries } from "@/app/api/sonarr/series/search/route";
import { POST as deleteSeriesFiles } from "@/app/api/sonarr/series/delete/route";
import { POST as createInstance } from "@/app/api/instances/route";
import { mswServer, sonarrHandlers } from "@/test/msw";

const ctxNone = { params: Promise.resolve({}) };
const baseUrl = "http://192.168.1.10:8989";

async function makeInstance(): Promise<number> {
  const res = await createInstance(
    new NextRequest("http://localhost/api/instances", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "sonarr",
        name: "Sonarr",
        url: baseUrl,
        apiKey: "abcd1234abcd1234abcd1234abcd1234",
      }),
    }),
    ctxNone,
  );
  return (await res.json()).id as number;
}

const profile = {
  id: 1,
  name: "HD-1080p",
  minUpgradeFormatScore: 0,
  cutoffFormatScore: 100,
  formatItems: [{ format: 10, name: "HDR", score: 50 }],
};

describe("GET /api/sonarr/series", () => {
  test("returns paginated SeriesItem wrapper", async () => {
    const instanceId = await makeInstance();
    await preferenceRepository.setForInstance(instanceId, [
      { cfId: 10, cfName: "HDR" },
    ]);
    mswServer.use(
      ...sonarrHandlers(
        { baseUrl },
        {
          series: [{ id: 1, title: "Show", year: 2024, qualityProfileId: 1 }],
          episodeFilesByseriesId: new Map([
            [
              1,
              [
                {
                  id: 100,
                  seriesId: 1,
                  seasonNumber: 1,
                  relativePath: "S01E01.mkv",
                  size: 1024,
                  customFormats: [],
                  customFormatScore: 0,
                },
              ],
            ],
          ]),
          qualityProfiles: [profile],
        },
      ),
    );
    const req = new NextRequest(
      `http://localhost/api/sonarr/series?instanceId=${instanceId}&page=1&limit=50`,
    );
    const res = await listSeries(req, ctxNone);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].episodeFiles).toHaveLength(1);
  });
});

describe("POST /api/sonarr/series/search", () => {
  test("enqueues a series search and returns 202", async () => {
    const instanceId = await makeInstance();
    mswServer.use(
      ...sonarrHandlers({ baseUrl }, { series: [], qualityProfiles: [] }),
    );
    const res = await searchSeries(
      new NextRequest("http://localhost/api/sonarr/series/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ instanceId, mediaId: 1, title: "Show" }),
      }),
      ctxNone,
    );
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.queued).toBe(true);
    expect(typeof body.queueId).toBe("number");
  });

  test("schema-failing body returns 400", async () => {
    const res = await searchSeries(
      new NextRequest("http://localhost/api/sonarr/series/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ instanceId: -1 }),
      }),
      ctxNone,
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/sonarr/series/delete", () => {
  test("deletes each fileId inline and enqueues the optional search", async () => {
    const instanceId = await makeInstance();
    const deletedFiles: number[] = [];
    let commandHit = false;
    mswServer.use(
      ...sonarrHandlers(
        { baseUrl },
        {
          onDeleteEpisodeFile: (fileId) => deletedFiles.push(fileId),
          onCommand: () => {
            commandHit = true;
          },
        },
      ),
    );
    const res = await deleteSeriesFiles(
      new NextRequest("http://localhost/api/sonarr/series/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          instanceId,
          mediaId: 1,
          fileIds: [10, 11],
          title: "Show",
          search: true,
        }),
      }),
      ctxNone,
    );
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("success");
    expect(deletedFiles.sort()).toEqual([10, 11]);
    // Search is queued for the worker — route does not dispatch it inline.
    expect(commandHit).toBe(false);
    const queued =
      await searchQueueRepository.findPendingByInstance(instanceId);
    expect(queued).toHaveLength(1);
    expect(queued[0].mediaId).toBe(1);
    expect(queued[0].action).toBe("series");
  });
});
