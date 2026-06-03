import { describe, test, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET as listReleases } from "@/app/api/radarr/movies/releases/route";
import { POST as grabRelease } from "@/app/api/radarr/movies/grab/route";
import { POST as createInstance } from "@/app/api/instances/route";
import { mswServer, radarrHandlers } from "@/test/msw";

const ctxNone = { params: Promise.resolve({}) };
const baseUrl = "http://192.168.1.10:7878";
const sonarrUrl = "http://192.168.1.11:8989";

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

describe("GET /api/radarr/movies/releases", () => {
  test("returns the mapped ReleaseCandidate[] through the full handler", async () => {
    const instanceId = await makeInstance("radarr", baseUrl);
    mswServer.use(
      ...radarrHandlers(
        { baseUrl },
        {
          releases: [
            {
              guid: "g1",
              indexerId: 7,
              indexer: "NZBgeek",
              title: "Movie.2024.2160p",
              protocol: "usenet",
              quality: { quality: { name: "Bluray-2160p" } },
              size: 1000,
              customFormatScore: 50,
              downloadAllowed: true,
            },
          ],
        },
      ),
    );
    const req = new NextRequest(
      `http://localhost/api/radarr/movies/releases?instanceId=${instanceId}&movieId=42`,
    );
    const res = await listReleases(req, ctxNone);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].quality).toBe("Bluray-2160p");
    expect(body[0].guid).toBe("g1");
  });

  test("rejects a non-positive movieId with 400", async () => {
    const instanceId = await makeInstance("radarr", baseUrl);
    const res = await listReleases(
      new NextRequest(
        `http://localhost/api/radarr/movies/releases?instanceId=${instanceId}&movieId=0`,
      ),
      ctxNone,
    );
    expect(res.status).toBe(400);
  });

  test("missing instance returns 404", async () => {
    const res = await listReleases(
      new NextRequest(
        "http://localhost/api/radarr/movies/releases?instanceId=99999&movieId=1",
      ),
      ctxNone,
    );
    expect(res.status).toBe(404);
  });

  test("a sonarr instance id returns 400 (wrong arr type)", async () => {
    const instanceId = await makeInstance("sonarr", sonarrUrl);
    const res = await listReleases(
      new NextRequest(
        `http://localhost/api/radarr/movies/releases?instanceId=${instanceId}&movieId=1`,
      ),
      ctxNone,
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/radarr/movies/grab", () => {
  test("force-grabs a release and returns the grabbed ActionLog", async () => {
    const instanceId = await makeInstance("radarr", baseUrl);
    let grabbed: unknown = null;
    mswServer.use(
      ...radarrHandlers(
        { baseUrl },
        {
          onGrab: (body) => {
            grabbed = body;
          },
        },
      ),
    );
    const res = await grabRelease(
      new NextRequest("http://localhost/api/radarr/movies/grab", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          instanceId,
          mediaId: 77,
          guid: "g9",
          indexerId: 3,
          title: "My Movie",
        }),
      }),
      ctxNone,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action).toBe("grab");
    expect(body.status).toBe("grabbed");
    expect(grabbed).toEqual({ guid: "g9", indexerId: 3, movieId: 77 });
  });

  test("schema-failing body returns 400", async () => {
    const res = await grabRelease(
      new NextRequest("http://localhost/api/radarr/movies/grab", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ instanceId: -1, mediaId: 0 }),
      }),
      ctxNone,
    );
    expect(res.status).toBe(400);
  });

  test("a sonarr instance id returns 400 (wrong arr type)", async () => {
    const instanceId = await makeInstance("sonarr", sonarrUrl);
    const res = await grabRelease(
      new NextRequest("http://localhost/api/radarr/movies/grab", {
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
      new NextRequest("http://localhost/api/radarr/movies/grab", {
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
