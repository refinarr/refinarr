import { logRepository } from "@/server/repositories/LogRepository";
import { appLogger } from "@/server/lib/app-logger";
import { LIFECYCLE_EVENT_TYPES } from "@/server/clients/ArrClient";
import type {
  ArrClient,
  LifecycleEventType,
  UpstreamCommand,
  UpstreamHistoryEvent,
} from "@/server/clients/ArrClient";
import { LogSource } from "@/shared/types/models";
import type {
  ActionLog,
  ActionStatus,
  ActionType,
  Instance,
} from "@/shared/types/models";

// Rolling time window for both poll passes. ActionLog rows older than
// this won't be re-correlated — the cost of an ancient grab silently
// reaching us is tiny, the cost of unbounded scans isn't.
const POLL_LOOKBACK_MS = 24 * 60 * 60 * 1000;

// Synthetic completionMessage stamped when upstream's /command response
// doesn't carry one (current Servarr versions) AND no `grabbed` event
// fired in /history for the same media after the command started.
// Reads as the answer to "did anything come of my search?" without
// requiring a deprecated upstream field. Stays opaque + stable so the
// idempotency check in `deriveCommandUpdate` keeps writes flat.
const NO_RELEASES_GRABBED_MESSAGE = "No releases grabbed";

// Type guard at the upstream→state-machine boundary. Upstream may emit
// eventTypes we don't act on (e.g. "movieFileRenamed", "downloadIgnored");
// the call site in pollHistory uses this to filter before dispatching,
// which lets `nextStatusFor` take the narrow LifecycleEventType union
// and stay exhaustively type-checked.
export function isLifecycleEvent(
  eventType: string,
): eventType is LifecycleEventType {
  return eventType in LIFECYCLE_EVENT_TYPES;
}

// Forward-only ActionLog status state machine driven by /history events.
// Cases match the keys of `LIFECYCLE_EVENT_TYPES` in ArrClient (the same
// mapper that builds the /history query filter from integer codes — see
// the comment there for why query and response disagree on shape). Add
// a new lifecycle event = add a key to the mapper, then add a case here
// — the union narrowing makes a missing case a build error.
//
// Returning null = no-op (idempotent re-poll, or the row is already at
// a higher state).
//
// Pure function — exhaustively tested.
export function nextStatusFor(
  eventType: LifecycleEventType,
  current: ActionStatus,
): ActionStatus | null {
  switch (eventType) {
    case "grabbed":
      return current === "searched" ? "grabbed" : null;
    case "downloadFolderImported":
      return current === "searched" || current === "grabbed"
        ? "downloaded"
        : null;
    case "downloadFailed":
      // Download failure is terminal-ish — only transition if we haven't
      // already moved past it. Keeps "downloaded" sticky if both events
      // somehow arrive (the import implies a retry succeeded).
      return current === "searched" || current === "grabbed" ? "failed" : null;
  }
}

// Failure derivation — both `failed` and `aborted` upstream statuses
// flip the row to failed, with the best human-readable error we can
// pull from the body. Idempotent: a row already at failed is a no-op.
function deriveFailedCommandUpdate(
  row: ActionLog,
  cmd: UpstreamCommand,
): Partial<ActionLog> | null {
  if (row.status === "failed") return null;
  return {
    status: "failed",
    error: cmd.body?.message ?? cmd.body?.completionMessage ?? "Command failed",
  };
}

// completionMessage derivation when the command finished. Three cases:
//   1. Upstream body carries an explicit message → stamp it (idempotent).
//   2. Row is past "searched" → don't synthesize (lifecycle states
//      already answer "did the search produce a release?"). Heal any
//      stale synthesis from earlier ticks: clear NO_RELEASES_GRABBED
//      from rows that have since advanced.
//   3. Row is at "searched" with no explicit message → synthesize
//      "No releases grabbed" iff no `grabbed` event fired for this
//      media after the command started.
function deriveCompletedCommandUpdate(
  row: ActionLog,
  cmd: UpstreamCommand,
  eventsForMedia: UpstreamHistoryEvent[],
): Partial<ActionLog> | null {
  const explicit = cmd.body?.completionMessage ?? null;
  if (explicit) {
    return row.completionMessage === explicit
      ? null
      : { completionMessage: explicit };
  }
  if (row.status !== "searched") {
    return row.completionMessage === NO_RELEASES_GRABBED_MESSAGE
      ? { completionMessage: null }
      : null;
  }
  const startedAt = cmd.started ? Date.parse(cmd.started) : 0;
  const grabbed = eventsForMedia.some(
    (e) =>
      e.eventType === "grabbed" &&
      (Number.isFinite(startedAt) ? Date.parse(e.date) >= startedAt : true),
  );
  if (grabbed || row.completionMessage === NO_RELEASES_GRABBED_MESSAGE) {
    return null;
  }
  return { completionMessage: NO_RELEASES_GRABBED_MESSAGE };
}

// Result of correlating a single command record to one of our open
// ActionLog rows. Returning null = no-op. The optional `eventsForMedia`
// is the slice of /history events for the row's mediaId (built once per
// tick by the worker) — it's used to synthesize a completionMessage
// when the upstream `body` doesn't carry one (current Servarr versions
// dropped that field for searches).
//
// Pure function — exhaustively tested.
export function deriveCommandUpdate(
  row: ActionLog,
  cmd: UpstreamCommand,
  eventsForMedia: UpstreamHistoryEvent[] = [],
): Partial<ActionLog> | null {
  if (cmd.status === "failed" || cmd.status === "aborted") {
    return deriveFailedCommandUpdate(row, cmd);
  }
  if (cmd.status === "completed") {
    return deriveCompletedCommandUpdate(row, cmd, eventsForMedia);
  }
  return null;
}

// Maps a /history event's media scope to the ActionLog `action` types
// that could have produced it. Episode events match episode-search
// rows; series-scope events match the series + season + episode search
// rows alike (the user asked about the series; any grab counts).
// "grab" is included so an interactive force-grab row (which lands at
// "grabbed" with no commandId) gets advanced to "downloaded" by the
// import event — its only lifecycle correlation, since it has no command
// to poll.
const EPISODE_ACTIONS: ActionType[] = ["search_episode"];
const SERIES_ACTIONS: ActionType[] = [
  "search",
  "search_season",
  "search_episode",
  "grab",
];
const MOVIE_ACTIONS: ActionType[] = ["search", "grab"];

function actionsForEvent(ev: UpstreamHistoryEvent): ActionType[] {
  if (ev.scope === "movie") return MOVIE_ACTIONS;
  if (ev.scope === "episode") return EPISODE_ACTIONS;
  return SERIES_ACTIONS;
}

// Status floor for correlation queries — only update rows currently at
// these states. Forward-only enforcement at the query level avoids
// fetching rows that are already at terminal/higher states.
const HISTORY_STATUS_FLOOR: ActionStatus[] = ["searched", "grabbed"];

// Build a per-mediaId index over a tick's history events. Built once
// by the worker and threaded into pollCommands so the command-sync
// pass can synthesize completionMessage without a second /history fetch.
export function indexEventsByMediaId(
  events: UpstreamHistoryEvent[],
): Map<number, UpstreamHistoryEvent[]> {
  const out = new Map<number, UpstreamHistoryEvent[]>();
  for (const ev of events) {
    const arr = out.get(ev.mediaId);
    if (arr) arr.push(ev);
    else out.set(ev.mediaId, [ev]);
  }
  return out;
}

/**
 * Per-instance command-sync + history-sync polling. Stateless across
 * calls — caller (statusPoller worker) owns the per-instance
 * `lastPolledAt` map and passes `since`. Idempotent: re-polling the
 * same window is a no-op if upstream state hasn't progressed.
 */
export class StatusPollerService {
  /**
   * Command sync: snapshot upstream's command queue, intersect with
   * our open ActionLog rows, apply deriveCommandUpdate per row. The
   * optional `eventsByMediaId` lets deriveCommandUpdate synthesize a
   * completionMessage on Servarr versions that don't include one in
   * the /command response.
   */
  async pollCommands(
    instance: Instance,
    client: ArrClient,
    eventsByMediaId: Map<number, UpstreamHistoryEvent[]> = new Map(),
  ): Promise<number> {
    const [commands, ours] = await Promise.all([
      client.getRecentCommands(),
      logRepository.findOpenCommandsByInstance(instance.id, POLL_LOOKBACK_MS),
    ]);
    // Only emit the diagnostic snapshot when there's something to
    // correlate. With no open rows on our side, the upstream sample is
    // a wall of noise that fires every 5 min per instance and dilutes
    // the log viewer.
    if (ours.length > 0) {
      appLogger.debug("statusPoller command-sync snapshot", {
        source: LogSource.StatusPoller,
        context: {
          instanceId: instance.id,
          upstreamCommands: commands.length,
          ourOpenRows: ours.length,
          ourCommandIds: ours.map((r) => r.commandId).filter(Boolean),
          upstreamSample: commands.slice(0, 10).map((c) => ({
            id: c.id,
            name: c.name,
            status: c.status,
            completionMessage: c.body?.completionMessage ?? null,
          })),
        },
      });
    }
    if (ours.length === 0) return 0;

    // Build the lookup ONCE per tick. Keyed by commandId; the row's
    // commandId is non-null per `findOpenCommandsByInstance`'s where clause.
    const byCommandId = new Map<number, ActionLog>();
    for (const r of ours) {
      if (r.commandId != null) byCommandId.set(r.commandId, r);
    }

    const aged = await this.fetchAgedOutCommands(
      instance,
      client,
      commands,
      byCommandId,
    );
    const allCommands = aged.length > 0 ? [...commands, ...aged] : commands;
    if (allCommands.length === 0) return 0;

    let updates = 0;
    for (const cmd of allCommands) {
      const row = byCommandId.get(cmd.id);
      if (!row) continue;
      const patch = deriveCommandUpdate(
        row,
        cmd,
        eventsByMediaId.get(row.mediaId),
      );
      if (!patch) continue;
      try {
        await logRepository.update(row.id, patch);
        updates += 1;
      } catch (err) {
        appLogger.warn("statusPoller command-sync update failed", {
          source: LogSource.StatusPoller,
          err,
          context: {
            instanceId: instance.id,
            actionLogId: row.id,
            commandId: cmd.id,
          },
        });
      }
    }
    return updates;
  }

  // Aged-out fallback. On a busy *arr the recent /command window
  // (~20 entries) rolls fast — ProcessMonitoredDownloads /
  // RefreshMonitoredDownloads stream commands every minute, so a
  // user-initiated search that found 0 releases ages off the recent
  // list within ~30 min. Without per-id lookup, those rows stay stuck
  // at "searched" forever. Returns the commands we successfully
  // re-fetched; nulls (404 / network failure) drop quietly so the row
  // waits for the next tick.
  private async fetchAgedOutCommands(
    instance: Instance,
    client: ArrClient,
    recent: UpstreamCommand[],
    byCommandId: Map<number, ActionLog>,
  ): Promise<UpstreamCommand[]> {
    const recentIds = new Set(recent.map((c) => c.id));
    const agedIds = [...byCommandId.keys()].filter((id) => !recentIds.has(id));
    if (agedIds.length === 0) return [];

    const results = await Promise.all(
      agedIds.map((id) => client.getCommandById(id)),
    );
    const aged = results.filter((c): c is UpstreamCommand => c !== null);
    if (aged.length > 0) {
      appLogger.debug("statusPoller fetched aged-out commands", {
        source: LogSource.StatusPoller,
        context: {
          instanceId: instance.id,
          requested: agedIds.length,
          fetched: aged.length,
          agedIds: aged.map((c) => c.id),
        },
      });
    }
    return aged;
  }

  /**
   * History sync: fetch /history events newer than `since`, correlate
   * each to the most-recent matching ActionLog row, advance its status
   * if the state machine allows. Returns the events alongside the
   * update count so the worker can feed them into the command-sync
   * pass for completionMessage synthesis.
   */
  async pollHistory(
    instance: Instance,
    client: ArrClient,
    since: Date,
  ): Promise<{ updates: number; events: UpstreamHistoryEvent[] }> {
    const events = await client.getRecentHistory(since);
    // Skip the snapshot on empty ticks. The common case for an active
    // instance is "0 new events since the last poll" — logging it every
    // 5 min would dominate the debug stream.
    if (events.length > 0) {
      appLogger.debug("statusPoller history-sync snapshot", {
        source: LogSource.StatusPoller,
        context: {
          instanceId: instance.id,
          sinceIso: since.toISOString(),
          eventsObserved: events.length,
          eventSample: events.slice(0, 10).map((e) => ({
            id: e.id,
            mediaId: e.mediaId,
            scope: e.scope,
            eventType: e.eventType,
            date: e.date,
          })),
        },
      });
    }
    if (events.length === 0) return { updates: 0, events };
    let updates = 0;
    // Process oldest-first so a grab+import for the same media in one
    // batch lands on the row in the right order (grabbed → downloaded).
    const ordered = [...events].sort(
      (a, b) => Date.parse(a.date) - Date.parse(b.date),
    );
    for (const ev of ordered) {
      // Skip eventTypes we don't act on at the boundary so nextStatusFor
      // can dispatch on the narrowed LifecycleEventType union.
      if (!isLifecycleEvent(ev.eventType)) continue;
      const row = await logRepository.findCorrelatableByMedia({
        instanceId: instance.id,
        mediaId: ev.mediaId,
        actions: actionsForEvent(ev),
        statusFloor: HISTORY_STATUS_FLOOR,
        sinceMs: POLL_LOOKBACK_MS,
      });
      if (!row) continue;
      const next = nextStatusFor(ev.eventType, row.status);
      if (!next || next === row.status) continue;
      // On the grab transition, capture the release name + download-client
      // handle so History can show "what was grabbed" (#39). Only on
      // `grabbed` — later events (import/fail) don't carry a more specific
      // release identity than the grab already recorded.
      const patch: Partial<ActionLog> =
        next === "grabbed"
          ? {
              status: next,
              sourceTitle: ev.sourceTitle,
              downloadId: ev.downloadId ?? null,
            }
          : { status: next };
      try {
        await logRepository.update(row.id, patch);
        updates += 1;
      } catch (err) {
        appLogger.warn("statusPoller history-sync update failed", {
          source: LogSource.StatusPoller,
          err,
          context: {
            instanceId: instance.id,
            actionLogId: row.id,
            eventType: ev.eventType,
          },
        });
      }
    }
    return { updates, events };
  }
}

export const statusPollerService = new StatusPollerService();
