import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import {
  deriveCommandUpdate,
  isLifecycleEvent,
  nextStatusFor,
  StatusPollerService,
} from "@/server/services/StatusPollerService";
import { logRepository } from "@/server/repositories/LogRepository";
import { instanceService } from "@/server/services/InstanceService";
import type {
  ArrClient,
  UpstreamCommand,
  UpstreamHistoryEvent,
} from "@/server/clients/ArrClient";
import type { ActionLog, ActionStatus, Instance } from "@/shared/types/models";

// === Pure state machine ===========================================
//
// Exhaustive truth table for the forward-only transitions. Anything
// the table doesn't list returns null — verified at the end with a
// "no other event flips a row" guard so adding a new event type can't
// silently activate a transition we didn't write.
describe("nextStatusFor — history-sync state machine", () => {
  test("grabbed event advances searched → grabbed", () => {
    expect(nextStatusFor("grabbed", "searched")).toBe("grabbed");
  });

  test("grabbed event is a no-op when row is already at higher state", () => {
    // Idempotency — a re-poll of the same window must not regress or
    // double-write. "grabbed" already-grabbed is the canonical case;
    // already-downloaded / already-failed are forward-only floors.
    for (const cur of ["grabbed", "downloaded", "failed"] as ActionStatus[]) {
      expect(nextStatusFor("grabbed", cur)).toBeNull();
    }
  });

  test("grabbed event ignored when row hasn't reached searched", () => {
    // pending / dry_run / success rows are not legitimate targets:
    //  - pending is a synthetic queue row that statusPoller doesn't see
    //  - dry_run never hits upstream so no real grab event can match it
    //  - "success" only applies to delete/ignore actions which don't
    //    have a corresponding grab event upstream
    for (const cur of ["pending", "dry_run", "success"] as ActionStatus[]) {
      expect(nextStatusFor("grabbed", cur)).toBeNull();
    }
  });

  test("downloadFolderImported advances searched or grabbed → downloaded", () => {
    expect(nextStatusFor("downloadFolderImported", "searched")).toBe(
      "downloaded",
    );
    expect(nextStatusFor("downloadFolderImported", "grabbed")).toBe(
      "downloaded",
    );
  });

  test("downloadFolderImported is a no-op on terminal states", () => {
    for (const cur of ["downloaded", "failed"] as ActionStatus[]) {
      expect(nextStatusFor("downloadFolderImported", cur)).toBeNull();
    }
  });

  test("downloadFailed transitions searched or grabbed → failed", () => {
    expect(nextStatusFor("downloadFailed", "searched")).toBe("failed");
    expect(nextStatusFor("downloadFailed", "grabbed")).toBe("failed");
  });

  test("downloadFailed does NOT regress downloaded back to failed", () => {
    // Sticky terminal: if we already saw the import succeed, a stale
    // failed event in the same /history window must not undo it.
    expect(nextStatusFor("downloadFailed", "downloaded")).toBeNull();
  });
});

// `nextStatusFor` is now type-narrow (LifecycleEventType only); the
// runtime equivalent of "unknown event types never transition" is
// covered here, where the upstream→state-machine boundary actually
// lives. The pollHistory loop calls isLifecycleEvent before invoking
// nextStatusFor so non-lifecycle records never reach the switch.
describe("isLifecycleEvent — upstream eventType guard", () => {
  test("accepts every key in LIFECYCLE_EVENT_TYPES", () => {
    expect(isLifecycleEvent("grabbed")).toBe(true);
    expect(isLifecycleEvent("downloadFolderImported")).toBe(true);
    expect(isLifecycleEvent("downloadFailed")).toBe(true);
  });

  test("rejects every non-lifecycle eventType the upstream might emit", () => {
    // Drawn from Servarr's HistoryEventType.cs — these are real upstream
    // events we don't act on. Plus a few junk values to cover the
    // boundary.
    for (const ev of [
      "downloadIgnored",
      "movieFileRenamed",
      "episodeFileRenamed",
      "seriesFolderImported",
      "rename",
      "weird",
      "",
    ]) {
      expect(isLifecycleEvent(ev)).toBe(false);
    }
  });
});

// === Pure command-sync correlation ================================
describe("deriveCommandUpdate — command-sync correlation", () => {
  function row(overrides: Partial<ActionLog> = {}): ActionLog {
    return {
      id: 1,
      instanceId: 1,
      action: "search",
      mediaId: 42,
      title: "X",
      isDryRun: false,
      status: "searched",
      error: null,
      payload: null,
      groupId: null,
      commandId: 7777,
      completionMessage: null,
      createdAt: new Date(),
      lastRetriedAt: null,
      ...overrides,
    };
  }

  test("upstream completed with completionMessage stamps it once", () => {
    const patch = deriveCommandUpdate(row(), {
      id: 7777,
      name: "MoviesSearch",
      status: "completed",
      body: { completionMessage: "Sent 1 release(s) to download client" },
    });
    expect(patch).toEqual({
      completionMessage: "Sent 1 release(s) to download client",
    });
  });

  test("repeated completed poll with same message is a no-op", () => {
    // Idempotency. Critical for memory + write traffic — a poll every
    // 5 min for an instance with 100 completed commands would otherwise
    // hammer the DB with no-op updates.
    const r = row({ completionMessage: "0 releases found" });
    const patch = deriveCommandUpdate(r, {
      id: 7777,
      name: "MoviesSearch",
      status: "completed",
      body: { completionMessage: "0 releases found" },
    });
    expect(patch).toBeNull();
  });

  // Newer Servarr versions don't include `body.completionMessage` for
  // searches; the old "0 releases found" string lives in /history per
  // release now. When upstream goes silent on /command and we observed
  // no `grabbed` event for the media, synthesize "No releases grabbed"
  // so the user can still see the search ran empty.
  test("completed without a message + no grab event → synthesizes 'No releases grabbed'", () => {
    const patch = deriveCommandUpdate(
      row(),
      {
        id: 7777,
        name: "MoviesSearch",
        status: "completed",
        body: { completionMessage: null },
      },
      [], // no /history events for this media
    );
    expect(patch).toEqual({ completionMessage: "No releases grabbed" });
  });

  test("completed without a message + grab event present → no synthesis", () => {
    // The lifecycle states (grabbed/downloaded) tell the story when a
    // release was fetched — completionMessage stays null.
    const patch = deriveCommandUpdate(
      row(),
      {
        id: 7777,
        name: "MoviesSearch",
        status: "completed",
        started: "2026-05-08T07:00:00Z",
      },
      [
        {
          id: 1,
          mediaId: 42,
          scope: "movie",
          eventType: "grabbed",
          date: "2026-05-08T07:00:30Z",
          sourceTitle: null,
        },
      ],
    );
    expect(patch).toBeNull();
  });

  test("synthesized message is idempotent — re-poll writes nothing", () => {
    // Critical for write-traffic: a stuck-empty row that polls every
    // 5 min would otherwise hammer the DB with no-op updates.
    const patch = deriveCommandUpdate(
      row({ completionMessage: "No releases grabbed" }),
      {
        id: 7777,
        name: "MoviesSearch",
        status: "completed",
        body: { completionMessage: null },
      },
      [],
    );
    expect(patch).toBeNull();
  });

  // Regression: synthesis used to re-fire on every subsequent tick
  // because /history's `since` window only includes events newer than
  // the last poll — so once the grab event was processed, it'd vanish
  // from later snapshots, eventsForMedia would be empty, and the
  // !grabbed path would fire again on a row that had already advanced
  // to grabbed/downloaded. Gate: only synthesize when row is still at
  // "searched"; once it moves on, the lifecycle status tells the story.
  test("synthesis is gated to rows at status='searched' (no re-fire on grabbed/downloaded)", () => {
    for (const status of ["grabbed", "downloaded"] as const) {
      const patch = deriveCommandUpdate(
        row({ status, completionMessage: null }),
        {
          id: 7777,
          name: "MoviesSearch",
          status: "completed",
          body: { completionMessage: null },
        },
        [], // empty: simulating a later tick where the grab event
        // already aged out of /history's since-window
      );
      expect(patch).toBeNull();
    }
  });

  // Healing path: a row that was correctly synthesized to "No releases
  // grabbed" while at "searched", then advanced to grabbed because a
  // late history event fired in a subsequent tick — the stale message
  // contradicts the new status. Clear it so the row reads cleanly.
  test("clears stale synthesized message when row advances past searched", () => {
    for (const status of ["grabbed", "downloaded"] as const) {
      const patch = deriveCommandUpdate(
        row({ status, completionMessage: "No releases grabbed" }),
        {
          id: 7777,
          name: "MoviesSearch",
          status: "completed",
          body: { completionMessage: null },
        },
        [],
      );
      expect(patch).toEqual({ completionMessage: null });
    }
  });

  // Don't blank explicit messages on rows past "searched". Older
  // Servarr versions (and some non-search commands like Backup) DO
  // populate body.completionMessage with a meaningful string — that
  // information stays valid even after lifecycle transitions.
  test("preserves explicit message on rows past searched", () => {
    const patch = deriveCommandUpdate(
      row({ status: "downloaded", completionMessage: "Sent 1 release(s)" }),
      {
        id: 7777,
        name: "MoviesSearch",
        status: "completed",
        body: { completionMessage: null },
      },
      [],
    );
    expect(patch).toBeNull();
  });

  test("grab event before command.started is ignored (older indexer churn)", () => {
    // A grabbed event from BEFORE this command started belongs to a
    // prior search — synthesis still applies because THIS search
    // produced nothing.
    const patch = deriveCommandUpdate(
      row(),
      {
        id: 7777,
        name: "MoviesSearch",
        status: "completed",
        started: "2026-05-08T08:00:00Z",
      },
      [
        {
          id: 1,
          mediaId: 42,
          scope: "movie",
          eventType: "grabbed",
          date: "2026-05-08T07:00:00Z", // ONE HOUR before command started
          sourceTitle: null,
        },
      ],
    );
    expect(patch).toEqual({ completionMessage: "No releases grabbed" });
  });

  test("upstream failed → status flips to failed with body.message", () => {
    const patch = deriveCommandUpdate(row(), {
      id: 7777,
      name: "MoviesSearch",
      status: "failed",
      body: { message: "Indexer unreachable" },
    });
    expect(patch).toEqual({
      status: "failed",
      error: "Indexer unreachable",
    });
  });

  test("upstream aborted is treated as failed", () => {
    const patch = deriveCommandUpdate(row(), {
      id: 7777,
      name: "MoviesSearch",
      status: "aborted",
      body: {},
    });
    expect(patch?.status).toBe("failed");
  });

  test("failed/aborted falls back to completionMessage when body.message is absent", () => {
    const patch = deriveCommandUpdate(row(), {
      id: 7777,
      name: "MoviesSearch",
      status: "failed",
      body: { completionMessage: "No indexers configured" },
    });
    expect(patch?.error).toBe("No indexers configured");
  });

  test("failed/aborted with neither field uses a sensible default", () => {
    const patch = deriveCommandUpdate(row(), {
      id: 7777,
      name: "MoviesSearch",
      status: "failed",
      body: {},
    });
    expect(patch?.error).toBe("Command failed");
  });

  test("re-polling an already-failed row doesn't churn", () => {
    const r = row({ status: "failed", error: "boom" });
    const patch = deriveCommandUpdate(r, {
      id: 7777,
      name: "MoviesSearch",
      status: "failed",
      body: { message: "boom" },
    });
    expect(patch).toBeNull();
  });

  test("queued / started commands return no-op (still in flight)", () => {
    for (const status of ["queued", "started"] as const) {
      const patch = deriveCommandUpdate(row(), {
        id: 7777,
        name: "MoviesSearch",
        status,
      });
      expect(patch).toBeNull();
    }
  });
});

// === Service against real DB + mock client ========================

const baseInstance = {
  type: "radarr" as const,
  name: "Test",
  url: "http://192.168.1.10:7878",
  apiKey: "abcd1234abcd1234abcd1234abcd1234",
};

function mockClient(opts: {
  commands?: UpstreamCommand[];
  history?: UpstreamHistoryEvent[];
  commandsError?: Error;
  historyError?: Error;
  // Per-id command lookup for aged-out fallback. Map keyed by commandId.
  // Missing keys = `/command/{id}` 404 → return null (caller skips the
  // row). `undefined` opts.byId = no per-id surface at all (legacy
  // tests pre-dating the fallback).
  byId?: Map<number, UpstreamCommand>;
}): ArrClient {
  return {
    getRecentCommands: vi.fn(async () => {
      if (opts.commandsError) throw opts.commandsError;
      return opts.commands ?? [];
    }),
    getCommandById: vi.fn(async (id: number) => opts.byId?.get(id) ?? null),
    getRecentHistory: vi.fn(async () => {
      if (opts.historyError) throw opts.historyError;
      return opts.history ?? [];
    }),
  } as unknown as ArrClient;
}

async function seedRow(
  instance: Instance,
  overrides: Partial<ActionLog> = {},
): Promise<ActionLog> {
  return logRepository.create({
    instanceId: instance.id,
    action: "search",
    mediaId: 42,
    title: "X",
    isDryRun: false,
    status: "searched",
    error: null,
    payload: null,
    groupId: null,
    commandId: 7777,
    completionMessage: null,
    lastRetriedAt: null,
    ...overrides,
  });
}

describe("StatusPollerService.pollCommands (command sync)", () => {
  let service: StatusPollerService;

  beforeEach(() => {
    service = new StatusPollerService();
  });

  test("matches commandId and stamps completionMessage", async () => {
    const inst = await instanceService.create(baseInstance);
    const row = await seedRow(inst);
    const updates = await service.pollCommands(
      inst,
      mockClient({
        commands: [
          {
            id: 7777,
            name: "MoviesSearch",
            status: "completed",
            body: { completionMessage: "0 releases found" },
          },
        ],
      }),
    );
    expect(updates).toBe(1);
    const after = await logRepository.findById(row.id);
    expect(after?.completionMessage).toBe("0 releases found");
    expect(after?.status).toBe("searched"); // unchanged — command sync doesn't grab
  });

  test("ignores commands not matching any tracked row (no false matches across instances)", async () => {
    const inst = await instanceService.create(baseInstance);
    await seedRow(inst, { commandId: 7777 });
    const updates = await service.pollCommands(
      inst,
      mockClient({
        commands: [
          {
            id: 9999,
            name: "MoviesSearch",
            status: "completed",
            body: { completionMessage: "Sent 1" },
          },
        ],
      }),
    );
    expect(updates).toBe(0);
  });

  test("upstream failed flips status + sets error", async () => {
    const inst = await instanceService.create(baseInstance);
    const row = await seedRow(inst, { commandId: 7777 });
    await service.pollCommands(
      inst,
      mockClient({
        commands: [
          {
            id: 7777,
            name: "MoviesSearch",
            status: "failed",
            body: { message: "Indexer down" },
          },
        ],
      }),
    );
    const after = await logRepository.findById(row.id);
    expect(after?.status).toBe("failed");
    expect(after?.error).toBe("Indexer down");
  });

  test("re-poll of already-stamped row is a no-op (idempotent)", async () => {
    const inst = await instanceService.create(baseInstance);
    const row = await seedRow(inst, {
      commandId: 7777,
      completionMessage: "0 releases found",
    });
    const updates = await service.pollCommands(
      inst,
      mockClient({
        commands: [
          {
            id: 7777,
            name: "MoviesSearch",
            status: "completed",
            body: { completionMessage: "0 releases found" },
          },
        ],
      }),
    );
    expect(updates).toBe(0);
    const after = await logRepository.findById(row.id);
    // No fields mutated — completionMessage stays the same, status stays at success.
    expect(after?.completionMessage).toBe(row.completionMessage);
    expect(after?.status).toBe(row.status);
  });

  test("rows without commandId are skipped", async () => {
    const inst = await instanceService.create(baseInstance);
    await seedRow(inst, { commandId: null });
    const updates = await service.pollCommands(
      inst,
      mockClient({
        commands: [
          {
            id: 7777,
            name: "MoviesSearch",
            status: "completed",
            body: { completionMessage: "x" },
          },
        ],
      }),
    );
    expect(updates).toBe(0);
  });

  test("zero commands or zero rows short-circuits without DB writes", async () => {
    const inst = await instanceService.create(baseInstance);
    expect(await service.pollCommands(inst, mockClient({ commands: [] }))).toBe(
      0,
    );
    // Now seed a row but return zero commands → aged-out fallback also
    // returns nothing (default mock has no `byId` map). Updates count
    // stays 0; the row waits for a future tick.
    await seedRow(inst);
    expect(await service.pollCommands(inst, mockClient({ commands: [] }))).toBe(
      0,
    );
  });

  // Aged-out fallback. The /command recent window rolls fast on busy
  // *arrs; a search whose result we never observe stays "searched"
  // forever unless we fall back to /command/{id} per-row.
  test("aged-out commands are fetched via getCommandById and stamped", async () => {
    const inst = await instanceService.create(baseInstance);
    const row = await seedRow(inst, { commandId: 7777 });
    // Recent /command doesn't include 7777 (cycled off the window),
    // but /command/7777 still resolves with the completed payload.
    const byId = new Map<number, UpstreamCommand>([
      [
        7777,
        {
          id: 7777,
          name: "MoviesSearch",
          status: "completed",
          body: { completionMessage: "0 releases found", message: null },
        },
      ],
    ]);
    const client = mockClient({
      commands: [
        {
          id: 9999,
          name: "ProcessMonitoredDownloads",
          status: "completed",
        },
      ],
      byId,
    });
    const updates = await service.pollCommands(inst, client);
    expect(updates).toBe(1);
    const after = await logRepository.findById(row.id);
    expect(after?.completionMessage).toBe("0 releases found");
    expect(client.getCommandById).toHaveBeenCalledWith(7777);
  });

  test("aged-out lookup returning null leaves the row at 'searched'", async () => {
    const inst = await instanceService.create(baseInstance);
    const row = await seedRow(inst, { commandId: 7777 });
    // Empty `byId` → /command/{id} returns null (404). Row untouched;
    // the next tick will try again.
    const updates = await service.pollCommands(
      inst,
      mockClient({ commands: [], byId: new Map() }),
    );
    expect(updates).toBe(0);
    const after = await logRepository.findById(row.id);
    expect(after?.status).toBe("searched");
    expect(after?.completionMessage).toBeNull();
  });

  test("rows already in /command's recent window do NOT trigger getCommandById", async () => {
    const inst = await instanceService.create(baseInstance);
    await seedRow(inst, { commandId: 7777 });
    const client = mockClient({
      commands: [
        {
          id: 7777,
          name: "MoviesSearch",
          status: "completed",
          body: { completionMessage: "Sent 1" },
        },
      ],
    });
    await service.pollCommands(inst, client);
    // Recent list had the id — no per-id fallback needed.
    expect(client.getCommandById).not.toHaveBeenCalled();
  });
});

describe("StatusPollerService.pollHistory (history sync)", () => {
  let service: StatusPollerService;

  beforeEach(() => {
    service = new StatusPollerService();
  });

  test("grabbed event advances most-recent matching row", async () => {
    const inst = await instanceService.create(baseInstance);
    const row = await seedRow(inst, { mediaId: 42, status: "searched" });
    const result = await service.pollHistory(
      inst,
      mockClient({
        history: [
          {
            id: 1,
            mediaId: 42,
            scope: "movie",
            eventType: "grabbed",
            date: new Date().toISOString(),
            sourceTitle: null,
          },
        ],
      }),
      new Date(0),
    );
    expect(result.updates).toBe(1);
    expect(result.events).toHaveLength(1);
    const after = await logRepository.findById(row.id);
    expect(after?.status).toBe("grabbed");
  });

  test("grabbed transition persists sourceTitle + downloadId (#39)", async () => {
    const inst = await instanceService.create(baseInstance);
    const row = await seedRow(inst, { mediaId: 42, status: "searched" });
    await service.pollHistory(
      inst,
      mockClient({
        history: [
          {
            id: 1,
            mediaId: 42,
            scope: "movie",
            eventType: "grabbed",
            date: new Date().toISOString(),
            sourceTitle: "Tears Of Steel (2012) 720p WEBRip-LAMA",
            downloadId: "D8CF1DCE819935BB",
          },
        ],
      }),
      new Date(0),
    );
    const after = await logRepository.findById(row.id);
    expect(after?.status).toBe("grabbed");
    expect(after?.sourceTitle).toBe("Tears Of Steel (2012) 720p WEBRip-LAMA");
    expect(after?.downloadId).toBe("D8CF1DCE819935BB");
  });

  test("grab + import in one batch advances grabbed → downloaded in order", async () => {
    // Critical: events arrive newest-first from upstream, but the
    // service must process oldest-first so grabbed lands BEFORE
    // downloaded. Otherwise the state machine drops the grabbed.
    const inst = await instanceService.create(baseInstance);
    const row = await seedRow(inst, { mediaId: 42, status: "searched" });
    const grabAt = new Date("2026-05-08T10:00:00Z").toISOString();
    const importAt = new Date("2026-05-08T10:05:00Z").toISOString();
    await service.pollHistory(
      inst,
      mockClient({
        // Upstream returns descending — the service must reverse internally.
        history: [
          {
            id: 2,
            mediaId: 42,
            scope: "movie",
            eventType: "downloadFolderImported",
            date: importAt,
            sourceTitle: null,
          },
          {
            id: 1,
            mediaId: 42,
            scope: "movie",
            eventType: "grabbed",
            date: grabAt,
            sourceTitle: null,
          },
        ],
      }),
      new Date(0),
    );
    const after = await logRepository.findById(row.id);
    expect(after?.status).toBe("downloaded");
  });

  test("event for unrelated mediaId is ignored", async () => {
    const inst = await instanceService.create(baseInstance);
    const row = await seedRow(inst, { mediaId: 42 });
    await service.pollHistory(
      inst,
      mockClient({
        history: [
          {
            id: 1,
            mediaId: 99,
            scope: "movie",
            eventType: "grabbed",
            date: new Date().toISOString(),
            sourceTitle: null,
          },
        ],
      }),
      new Date(0),
    );
    const after = await logRepository.findById(row.id);
    expect(after?.status).toBe("searched"); // unchanged
  });

  test("dry-run rows are not correlated (real history events shouldn't touch previews)", async () => {
    const inst = await instanceService.create(baseInstance);
    const row = await seedRow(inst, { isDryRun: true, status: "dry_run" });
    await service.pollHistory(
      inst,
      mockClient({
        history: [
          {
            id: 1,
            mediaId: 42,
            scope: "movie",
            eventType: "grabbed",
            date: new Date().toISOString(),
            sourceTitle: null,
          },
        ],
      }),
      new Date(0),
    );
    const after = await logRepository.findById(row.id);
    expect(after?.status).toBe("dry_run");
  });

  test("episode event matches search_episode rows, not search rows", async () => {
    const inst = await instanceService.create({
      ...baseInstance,
      type: "sonarr" as const,
    });
    const seriesRow = await seedRow(inst, {
      action: "search",
      mediaId: 100,
    });
    const episodeRow = await seedRow(inst, {
      action: "search_episode",
      mediaId: 5001,
    });
    await service.pollHistory(
      inst,
      mockClient({
        history: [
          {
            id: 1,
            mediaId: 5001,
            scope: "episode",
            eventType: "grabbed",
            date: new Date().toISOString(),
            sourceTitle: null,
          },
        ],
      }),
      new Date(0),
    );
    expect((await logRepository.findById(episodeRow.id))?.status).toBe(
      "grabbed",
    );
    expect((await logRepository.findById(seriesRow.id))?.status).toBe(
      "searched",
    );
  });
});

// === Failure isolation =============================================
describe("StatusPollerService — error handling", () => {
  let service: StatusPollerService;
  beforeEach(() => {
    service = new StatusPollerService();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("client error in pollCommands propagates (worker handles + logs)", async () => {
    const inst = await instanceService.create(baseInstance);
    await expect(
      service.pollCommands(
        inst,
        mockClient({ commandsError: new Error("network down") }),
      ),
    ).rejects.toThrow(/network down/);
  });

  test("a single row update failure doesn't abort the rest", async () => {
    const inst = await instanceService.create(baseInstance);
    const r1 = await seedRow(inst, { commandId: 7777, mediaId: 1 });
    await seedRow(inst, { commandId: 7778, mediaId: 2 });
    // Force one logRepository.update to throw — the loop should
    // continue with the next row.
    const original = logRepository.update.bind(logRepository);
    let calls = 0;
    vi.spyOn(logRepository, "update").mockImplementation((id, data) => {
      calls += 1;
      if (id === r1.id) throw new Error("transient db error");
      return original(id, data);
    });
    const updates = await service.pollCommands(
      inst,
      mockClient({
        commands: [
          {
            id: 7777,
            name: "MoviesSearch",
            status: "completed",
            body: { completionMessage: "x" },
          },
          {
            id: 7778,
            name: "MoviesSearch",
            status: "completed",
            body: { completionMessage: "y" },
          },
        ],
      }),
    );
    expect(updates).toBe(1);
    expect(calls).toBe(2);
  });
});
