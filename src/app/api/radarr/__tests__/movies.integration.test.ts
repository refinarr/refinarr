import { describe, test, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET as listMovies } from "@/app/api/radarr/movies/route";
import { POST as searchMovie } from "@/app/api/radarr/movies/search/route";
import { GET as listProfiles } from "@/app/api/radarr/qualityprofiles/route";
import { POST as createInstance } from "@/app/api/instances/route";
import { mswServer, radarrHandlers } from "@/test/msw";
import { preferenceRepository } from "@/server/repositories/PreferenceRepository";

const ctxNone = { params: Promise.resolve({}) };
const baseUrl = "http://192.168.1.10:7878";

async function makeInstance(): Promise<number> {
  const res = await createInstance(
    new NextRequest("http://localhost/api/instances", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "radarr",
        name: "Radarr",
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
  formatItems: [
    { format: 10, name: "HDR", score: 50 },
    { format: 11, name: "Atmos", score: 30 },
  ],
};

describe("GET /api/radarr/movies", () => {
  test("returns paginated FlaggedMovie wrapper through the full route handler", async () => {
    const instanceId = await makeInstance();
    await preferenceRepository.setForInstance(instanceId, [{ cfId: 10, cfName: "HDR" }]);
    mswServer.use(...radarrHandlers({ baseUrl }, {
      movies: [
        { id: 1, title: "Flagged", year: 2024, qualityProfileId: 1, hasFile: true, movieFileId: 100 },
      ],
      movieFiles: [{ id: 100, movieId: 1, size: 1024, customFormats: [], customFormatScore: 0 }],
      qualityProfiles: [profile],
    }));
    const req = new NextRequest(`http://localhost/api/radarr/movies?instanceId=${instanceId}&page=1&limit=50`);
    const res = await listMovies(req, ctxNone);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].title).toBe("Flagged");
    expect(body.total).toBe(1);
    expect(body.hasMore).toBe(false);
  });
});

describe("POST /api/radarr/movies/search", () => {
  test("enqueues a movie search and returns 202 (queue takes over upstream dispatch)", async () => {
    const instanceId = await makeInstance();
    let commandHit = false;
    mswServer.use(...radarrHandlers({ baseUrl }, {
      movies: [], movieFiles: [], qualityProfiles: [],
      onCommand: () => { commandHit = true; },
    }));
    const res = await searchMovie(new NextRequest("http://localhost/api/radarr/movies/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ instanceId, mediaId: 1, title: "X" }),
    }), ctxNone);
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.queued).toBe(true);
    expect(typeof body.queueId).toBe("number");
    // Worker is what actually hits upstream — the route only enqueues.
    expect(commandHit).toBe(false);
  });

  test("schema-failing body returns 400", async () => {
    const res = await searchMovie(new NextRequest("http://localhost/api/radarr/movies/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ instanceId: -1, mediaId: 0 }),
    }), ctxNone);
    expect(res.status).toBe(400);
  });

  test("malformed JSON returns 400", async () => {
    const res = await searchMovie(new NextRequest("http://localhost/api/radarr/movies/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not-json",
    }), ctxNone);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/radarr/qualityprofiles", () => {
  test("forwards profiles from the upstream", async () => {
    const instanceId = await makeInstance();
    mswServer.use(...radarrHandlers({ baseUrl }, { qualityProfiles: [profile] }));
    const req = new NextRequest(`http://localhost/api/radarr/qualityprofiles?instanceId=${instanceId}`);
    const res = await listProfiles(req, ctxNone);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0].cutoffFormatScore).toBe(100);
  });

  test("missing instance returns 404", async () => {
    const req = new NextRequest("http://localhost/api/radarr/qualityprofiles?instanceId=99999");
    const res = await listProfiles(req, ctxNone);
    expect(res.status).toBe(404);
  });
});
