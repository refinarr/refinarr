import { describe, test, expect, vi, afterEach } from "vitest";
import { SonarrClient } from "@/server/clients/SonarrClient";
import type { UpstreamHistoryEvent } from "@/server/clients/ArrClient";
import type { Instance } from "@/shared/types/models";

function instance(): Instance {
  return {
    id: 1,
    type: "sonarr",
    name: "Test",
    url: "http://localhost:8989",
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

// Sonarr lifecycle records carry both an episodeId and a seriesId, so the
// projection must fan ONE record out to an episode-scoped AND a
// series-scoped event — the series event is what lets a season force-grab
// row (mediaId=seriesId) reach `downloaded`/`failed`. Regression guard for
// #111, where episode-only projection left those rows stuck at `grabbed`.
describe("SonarrClient.projectHistoryRecord (via getRecentHistory)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  afterEach(() => fetchSpy?.mockRestore());

  async function eventsFor(
    records: Record<string, unknown>[],
  ): Promise<UpstreamHistoryEvent[]> {
    fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ records }));
    return new SonarrClient(instance()).getRecentHistory(new Date(0));
  }

  for (const eventType of [
    "grabbed",
    "downloadFolderImported",
    "downloadFailed",
  ] as const) {
    test(`${eventType} record with both ids fans out to episode + series`, async () => {
      const events = await eventsFor([
        {
          id: 7,
          eventType,
          date: "2026-01-01T00:00:00Z",
          episodeId: 158,
          seriesId: 2,
          sourceTitle: "Show S03E03",
          downloadId: "ABC123",
        },
      ]);

      expect(events).toHaveLength(2);
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 7,
            mediaId: 158,
            scope: "episode",
            eventType,
          }),
          expect.objectContaining({
            id: 7,
            mediaId: 2,
            scope: "series",
            eventType,
          }),
        ]),
      );
      // Both projected events inherit the record's identity metadata.
      expect(
        events.every(
          (e) => e.downloadId === "ABC123" && e.sourceTitle === "Show S03E03",
        ),
      ).toBe(true);
    });
  }

  test("episode-only record → a single episode event", async () => {
    const events = await eventsFor([
      {
        id: 1,
        eventType: "grabbed",
        date: "2026-01-01T00:00:00Z",
        episodeId: 158,
      },
    ]);
    expect(events).toEqual([
      expect.objectContaining({ mediaId: 158, scope: "episode" }),
    ]);
  });

  test("series-only record → a single series event", async () => {
    const events = await eventsFor([
      {
        id: 1,
        eventType: "downloadFolderImported",
        date: "2026-01-01T00:00:00Z",
        seriesId: 2,
      },
    ]);
    expect(events).toEqual([
      expect.objectContaining({ mediaId: 2, scope: "series" }),
    ]);
  });

  test("record with neither id is skipped", async () => {
    const events = await eventsFor([
      { id: 1, eventType: "grabbed", date: "2026-01-01T00:00:00Z" },
    ]);
    expect(events).toEqual([]);
  });
});
