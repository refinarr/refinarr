import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { movieService, seriesService } from "@/server/arr/composition";
import { instanceService } from "@/server/services/InstanceService";
import { configRepository } from "@/server/repositories/ConfigRepository";
import { logRepository } from "@/server/repositories/LogRepository";

const fetchMock =
  vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const radarrInstance = {
  type: "radarr" as const,
  name: "Test Radarr",
  url: "http://192.168.1.10:7878",
  apiKey: "abcd1234abcd1234abcd1234abcd1234",
};

const sonarrInstance = {
  type: "sonarr" as const,
  name: "Test Sonarr",
  url: "http://192.168.1.11:8989",
  apiKey: "abcd1234abcd1234abcd1234abcd1234",
};

// POST /release returns no command id; everything else (the auto-runner's
// /command + /history polls) is harmless. The release grab itself resolves
// to a 201 with an empty body.
function setupArrMocks() {
  fetchMock.mockImplementation(async (url: string) => {
    // Query (GET /release?…) must be matched before the bare POST /release
    // grab, or the generic substring check shadows it and a list query
    // gets a 201 empty body instead of JSON.
    if (url.includes("/api/v3/release?")) return jsonResponse([]);
    if (url.includes("/api/v3/release"))
      return new Response(null, { status: 201 });
    return new Response("", { status: 200 });
  });
}

describe("MovieService.getReleases", () => {
  test("delegates to the radarr client and returns mapped candidates", async () => {
    const instance = await instanceService.create(radarrInstance);
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/api/v3/release?movieId="))
        return jsonResponse([
          {
            guid: "g1",
            title: "A",
            quality: { quality: { name: "WEB-1080p" } },
          },
        ]);
      return new Response("", { status: 200 });
    });
    const releases = await movieService.getReleases(instance.id, 42);
    expect(releases).toHaveLength(1);
    expect(releases[0].guid).toBe("g1");
    expect(releases[0].quality).toBe("WEB-1080p");
  });

  test("throws when the instance is the wrong arr type", async () => {
    const instance = await instanceService.create(sonarrInstance);
    await expect(movieService.getReleases(instance.id, 1)).rejects.toThrow(
      /expected radarr/,
    );
  });
});

describe("MovieService.grabRelease", () => {
  test("live grab lands the row at status='grabbed' with no payload", async () => {
    const instance = await instanceService.create(radarrInstance);
    setupArrMocks();
    const log = await movieService.grabRelease(
      instance.id,
      77,
      { guid: "g9", indexerId: 3 },
      "My Movie",
    );
    expect(log.action).toBe("grab");
    expect(log.status).toBe("grabbed");
    expect(log.isDryRun).toBe(false);
    expect(log.payload).toBeNull();
  });

  test("dry-run returns status='dry_run' and never POSTs to upstream", async () => {
    const instance = await instanceService.create(radarrInstance);
    await configRepository.set("dryRun", "true");
    setupArrMocks();
    const log = await movieService.grabRelease(
      instance.id,
      77,
      { guid: "g9", indexerId: 3 },
      "My Movie",
    );
    expect(log.status).toBe("dry_run");
    expect(log.isDryRun).toBe(true);
    const grabPosts = fetchMock.mock.calls.filter(
      ([url, init]) =>
        url.includes("/api/v3/release") && init?.method === "POST",
    );
    expect(grabPosts).toHaveLength(0);
  });

  test("propagates groupId onto the action log row", async () => {
    const instance = await instanceService.create(radarrInstance);
    setupArrMocks();
    const log = await movieService.grabRelease(
      instance.id,
      77,
      { guid: "g9", indexerId: 3 },
      "My Movie",
      { groupId: "batch-1" },
    );
    expect(log.groupId).toBe("batch-1");
  });

  test("upstream failure marks the row failed", async () => {
    const instance = await instanceService.create(radarrInstance);
    fetchMock.mockResolvedValue(new Response("nope", { status: 500 }));
    const log = await movieService.grabRelease(
      instance.id,
      77,
      { guid: "g9", indexerId: 3 },
      "My Movie",
    );
    expect(log.status).toBe("failed");
    expect(log.error).toBeTruthy();
  });

  test("rejects a wrong-arr-type instance before touching upstream", async () => {
    const instance = await instanceService.create(sonarrInstance);
    await expect(
      movieService.grabRelease(
        instance.id,
        1,
        { guid: "g", indexerId: 0 },
        "X",
      ),
    ).rejects.toThrow(/expected radarr/);
  });
});

describe("SeriesService.getSeasonReleases", () => {
  test("delegates to the sonarr client and returns mapped candidates", async () => {
    const instance = await instanceService.create(sonarrInstance);
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/api/v3/release?seriesId="))
        return jsonResponse([
          { guid: "s1", title: "S01", protocol: "torrent" },
        ]);
      return new Response("", { status: 200 });
    });
    const releases = await seriesService.getSeasonReleases(instance.id, 12, 3);
    expect(releases).toHaveLength(1);
    expect(releases[0].guid).toBe("s1");
  });

  test("throws when the instance is the wrong arr type", async () => {
    const instance = await instanceService.create(radarrInstance);
    await expect(
      seriesService.getSeasonReleases(instance.id, 1, 0),
    ).rejects.toThrow(/expected sonarr/);
  });
});

describe("SeriesService.grabSeasonRelease", () => {
  test("live grab lands the row at status='grabbed' with no payload", async () => {
    const instance = await instanceService.create(sonarrInstance);
    setupArrMocks();
    const log = await seriesService.grabSeasonRelease(
      instance.id,
      12,
      { guid: "sx", indexerId: 4 },
      "My Show — Season 3",
    );
    expect(log.action).toBe("grab");
    expect(log.status).toBe("grabbed");
    expect(log.payload).toBeNull();
    expect(await logRepository.findById(log.id)).not.toBeNull();
  });

  test("dry-run returns status='dry_run' and never POSTs to upstream", async () => {
    const instance = await instanceService.create(sonarrInstance);
    await configRepository.set("dryRun", "true");
    setupArrMocks();
    const log = await seriesService.grabSeasonRelease(
      instance.id,
      12,
      { guid: "sx", indexerId: 4 },
      "My Show — Season 3",
    );
    expect(log.status).toBe("dry_run");
    const grabPosts = fetchMock.mock.calls.filter(
      ([url, init]) =>
        url.includes("/api/v3/release") && init?.method === "POST",
    );
    expect(grabPosts).toHaveLength(0);
  });

  test("rejects a wrong-arr-type instance before touching upstream", async () => {
    const instance = await instanceService.create(radarrInstance);
    await expect(
      seriesService.grabSeasonRelease(
        instance.id,
        1,
        { guid: "g", indexerId: 0 },
        "X",
      ),
    ).rejects.toThrow(/expected sonarr/);
  });
});
