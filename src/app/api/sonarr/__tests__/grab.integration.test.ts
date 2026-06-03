import { describe, test, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET as listReleases } from "@/app/api/sonarr/series/releases/route";
import { POST as grabRelease } from "@/app/api/sonarr/series/grab/route";
import { POST as createInstance } from "@/app/api/instances/route";
import { mswServer, sonarrHandlers } from "@/test/msw";

const ctxNone = { params: Promise.resolve({}) };
const baseUrl = "http://192.168.1.11:8989";
const radarrUrl = "http://192.168.1.10:7878";

async function makeInstance(
  type: "radarr" | "sonarr",
  url: string,
): Promise<number> {
  const res = await createInstance(
    new NextRequest("http://localhost/api/instances", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type,
        name: type,
        url,
        apiKey: "abcd1234abcd1234abcd1234abcd1234",
      }),
    }),
    ctxNone,
  );
  return (await res.json()).id as number;
}

describe("GET /api/sonarr/series/releases", () => {
  test("returns the mapped ReleaseCandidate[] for a season", async () => {
    const instanceId = await makeInstance("sonarr", baseUrl);
    mswServer.use(
      ...sonarrHandlers(
        { baseUrl },
        {
          releases: [
            {
              guid: "s1",
              indexerId: 2,
              indexer: "NZBgeek",
              title: "Show.S03.1080p",
              protocol: "torrent",
              quality: { quality: { name: "WEBDL-1080p" } },
              seeders: 10,
              size: 5000,
              customFormatScore: 20,
              downloadAllowed: true,
            },
          ],
        },
      ),
    );
    const req = new NextRequest(
      `http://localhost/api/sonarr/series/releases?instanceId=${instanceId}&seriesId=12&seasonNumber=3`,
    );
    const res = await listReleases(req, ctxNone);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].quality).toBe("WEBDL-1080p");
    expect(body[0].seeders).toBe(10);
  });

  test("season 0 (Specials) is accepted", async () => {
    const instanceId = await makeInstance("sonarr", baseUrl);
    mswServer.use(...sonarrHandlers({ baseUrl }, { releases: [] }));
    const res = await listReleases(
      new NextRequest(
        `http://localhost/api/sonarr/series/releases?instanceId=${instanceId}&seriesId=12&seasonNumber=0`,
      ),
      ctxNone,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  test("a negative seasonNumber returns 400", async () => {
    const instanceId = await makeInstance("sonarr", baseUrl);
    const res = await listReleases(
      new NextRequest(
        `http://localhost/api/sonarr/series/releases?instanceId=${instanceId}&seriesId=12&seasonNumber=-1`,
      ),
      ctxNone,
    );
    expect(res.status).toBe(400);
  });

  test("a radarr instance id returns 400 (wrong arr type)", async () => {
    const instanceId = await makeInstance("radarr", radarrUrl);
    const res = await listReleases(
      new NextRequest(
        `http://localhost/api/sonarr/series/releases?instanceId=${instanceId}&seriesId=1&seasonNumber=1`,
      ),
      ctxNone,
    );
    expect(res.status).toBe(400);
  });

  test("missing instance returns 404", async () => {
    const res = await listReleases(
      new NextRequest(
        "http://localhost/api/sonarr/series/releases?instanceId=99999&seriesId=1&seasonNumber=1",
      ),
      ctxNone,
    );
    expect(res.status).toBe(404);
  });
});

describe("POST /api/sonarr/series/grab", () => {
  test("force-grabs a season release and returns the grabbed ActionLog", async () => {
    const instanceId = await makeInstance("sonarr", baseUrl);
    let grabbed: unknown = null;
    mswServer.use(
      ...sonarrHandlers(
        { baseUrl },
        {
          onGrab: (body) => {
            grabbed = body;
          },
        },
      ),
    );
    const res = await grabRelease(
      new NextRequest("http://localhost/api/sonarr/series/grab", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          instanceId,
          mediaId: 12,
          guid: "sx",
          indexerId: 4,
          title: "My Show — Season 3",
        }),
      }),
      ctxNone,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action).toBe("grab");
    expect(body.status).toBe("grabbed");
    // Sonarr grab body carries no movieId — only guid + indexerId.
    expect(grabbed).toEqual({ guid: "sx", indexerId: 4 });
  });

  test("schema-failing body returns 400", async () => {
    const res = await grabRelease(
      new NextRequest("http://localhost/api/sonarr/series/grab", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ instanceId: -1, mediaId: 0 }),
      }),
      ctxNone,
    );
    expect(res.status).toBe(400);
  });

  // Regression (Forge QA): magnet-link guids carry the full tracker list
  // and routinely exceed 1KB — the schema must accept them, or force-grab
  // 400s before reaching Sonarr for any magnet-returning indexer.
  test("accepts a long magnet-style guid (>1024 chars)", async () => {
    const instanceId = await makeInstance("sonarr", baseUrl);
    mswServer.use(...sonarrHandlers({ baseUrl }, { onGrab: () => {} }));
    const longGuid =
      "magnet:?xt=urn:btih:" +
      "a".repeat(40) +
      "&dn=Show.S02.2160p" +
      "&tr=http://tracker.example/announce".repeat(40); // ~1.5KB
    expect(longGuid.length).toBeGreaterThan(1024);
    const res = await grabRelease(
      new NextRequest("http://localhost/api/sonarr/series/grab", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          instanceId,
          mediaId: 12,
          guid: longGuid,
          indexerId: 4,
          title: "My Show — Season 2",
        }),
      }),
      ctxNone,
    );
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("grabbed");
  });

  test("a radarr instance id returns 400 (wrong arr type)", async () => {
    const instanceId = await makeInstance("radarr", radarrUrl);
    const res = await grabRelease(
      new NextRequest("http://localhost/api/sonarr/series/grab", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          instanceId,
          mediaId: 1,
          guid: "g",
          indexerId: 0,
          title: "X",
        }),
      }),
      ctxNone,
    );
    expect(res.status).toBe(400);
  });

  test("missing instance returns 404", async () => {
    const res = await grabRelease(
      new NextRequest("http://localhost/api/sonarr/series/grab", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          instanceId: 99999,
          mediaId: 1,
          guid: "g",
          indexerId: 0,
          title: "X",
        }),
      }),
      ctxNone,
    );
    expect(res.status).toBe(404);
  });
});
