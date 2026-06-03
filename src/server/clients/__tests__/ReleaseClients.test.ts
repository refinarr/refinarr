import { describe, test, expect, vi, afterEach } from "vitest";
import { RadarrClient } from "@/server/clients/RadarrClient";
import { SonarrClient } from "@/server/clients/SonarrClient";
import {
  mapReleaseCandidate,
  type UpstreamRelease,
} from "@/server/clients/ArrClient";
import type { Instance } from "@/shared/types/models";

function instance(type: "radarr" | "sonarr"): Instance {
  return {
    id: 1,
    type,
    name: "Test",
    url: type === "radarr" ? "http://localhost:7878" : "http://localhost:8989",
    apiKey: "key",
    enabled: true,
    searchesPerHour: 20,
    showAllMedia: false,
    createdAt: new Date(),
    autoSearchEnabled: false,
    autoSearchScheduleMode: "interval",
    autoSearchIntervalMinutes: 1440,
    autoSearchCronExpression: "0 3 * * *",
    autoSearchBatchLimit: 5,
    autoSearchLastRunAt: null,
    autoSearchMonitoredOnly: true,
    autoSearchScope: "flagged",
    autoSearchPickStrategy: "balanced",
    autoSearchCooldownHours: 0,
    autoSearchPausedUntil: null,
    autoSearchFailedStreak: 0,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// mapReleaseCandidate is the projection both subclasses reuse. Its
// defaulting behaviour is the user-visible contract (the picker reads
// these fields), so it gets its own exhaustive coverage.
describe("mapReleaseCandidate", () => {
  test("flattens quality + maps every field from a fully-populated release", () => {
    const upstream: UpstreamRelease = {
      guid: "g1",
      indexerId: 7,
      indexer: "NZBgeek",
      title: "Movie.2024.2160p.BluRay",
      protocol: "usenet",
      quality: { quality: { name: "Bluray-2160p" } },
      size: 1234,
      seeders: 42,
      ageHours: 5,
      customFormats: [
        { id: 10, name: "HDR" },
        { id: 11, name: "Atmos" },
      ],
      customFormatScore: 150,
      rejections: ["already imported"],
      downloadAllowed: true,
    };
    expect(mapReleaseCandidate(upstream)).toEqual({
      guid: "g1",
      indexerId: 7,
      indexer: "NZBgeek",
      title: "Movie.2024.2160p.BluRay",
      protocol: "usenet",
      quality: "Bluray-2160p",
      size: 1234,
      seeders: 42,
      ageHours: 5,
      customFormats: [
        { id: 10, name: "HDR" },
        { id: 11, name: "Atmos" },
      ],
      customFormatScore: 150,
      rejections: ["already imported"],
      downloadAllowed: true,
    });
  });

  test("applies every default for a near-empty release", () => {
    const mapped = mapReleaseCandidate({ guid: "g", title: "t" });
    expect(mapped).toEqual({
      guid: "g",
      indexerId: 0,
      indexer: "",
      title: "t",
      protocol: "torrent",
      quality: "Unknown",
      size: 0,
      seeders: null,
      ageHours: undefined,
      customFormats: [],
      customFormatScore: 0,
      rejections: [],
      downloadAllowed: false,
    });
  });

  test("protocol is 'torrent' for anything that isn't exactly 'usenet'", () => {
    expect(
      mapReleaseCandidate({ guid: "g", title: "t", protocol: "torrent" })
        .protocol,
    ).toBe("torrent");
    expect(
      mapReleaseCandidate({ guid: "g", title: "t", protocol: "USENET" })
        .protocol,
    ).toBe("torrent");
    expect(
      mapReleaseCandidate({ guid: "g", title: "t", protocol: "usenet" })
        .protocol,
    ).toBe("usenet");
  });

  test("quality falls back to 'Unknown' when the nested name is absent", () => {
    expect(
      mapReleaseCandidate({ guid: "g", title: "t", quality: {} }).quality,
    ).toBe("Unknown");
  });
});

describe("RadarrClient interactive search", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  afterEach(() => fetchSpy?.mockRestore());

  test("getReleases queries /release?movieId= and maps the candidates", async () => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse([
        {
          guid: "g1",
          title: "A",
          quality: { quality: { name: "WEB-1080p" } },
        },
      ]),
    );
    const client = new RadarrClient(instance("radarr"));
    const releases = await client.getReleases(55);
    expect(releases).toHaveLength(1);
    expect(releases[0].quality).toBe("WEB-1080p");
    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe("http://localhost:7878/api/v3/release?movieId=55");
  });

  test("getReleases tolerates a null/empty upstream body", async () => {
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));
    const client = new RadarrClient(instance("radarr"));
    await expect(client.getReleases(1)).resolves.toEqual([]);
  });

  test("grabRelease POSTs guid + indexerId + movieId to /release", async () => {
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 201 }));
    const client = new RadarrClient(instance("radarr"));
    await client.grabRelease({ guid: "g9", indexerId: 3, movieId: 77 });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("http://localhost:7878/api/v3/release");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({
      guid: "g9",
      indexerId: 3,
      movieId: 77,
    });
  });
});

describe("SonarrClient interactive search", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  afterEach(() => fetchSpy?.mockRestore());

  test("getSeasonReleases queries /release?seriesId=&seasonNumber= and maps", async () => {
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        jsonResponse([{ guid: "s1", title: "S01", protocol: "torrent" }]),
      );
    const client = new SonarrClient(instance("sonarr"));
    const releases = await client.getSeasonReleases(12, 3);
    expect(releases).toHaveLength(1);
    expect(releases[0].protocol).toBe("torrent");
    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe(
      "http://localhost:8989/api/v3/release?seriesId=12&seasonNumber=3",
    );
  });

  test("getSeasonReleases supports season 0 (Specials)", async () => {
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse([]));
    const client = new SonarrClient(instance("sonarr"));
    await client.getSeasonReleases(12, 0);
    const [url] = fetchSpy.mock.calls[0];
    expect(url).toContain("seasonNumber=0");
  });

  test("grabRelease POSTs guid + indexerId (no movieId) to /release", async () => {
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 201 }));
    const client = new SonarrClient(instance("sonarr"));
    await client.grabRelease({ guid: "sx", indexerId: 4 });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("http://localhost:8989/api/v3/release");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({
      guid: "sx",
      indexerId: 4,
    });
  });
});
