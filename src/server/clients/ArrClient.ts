import { appLogger } from "@/server/lib/app-logger";
import { assertSafeArrUrl } from "@/server/lib/url-guard";
import { redactString } from "@/server/lib/redact";
import { arrRateLimiter } from "@/server/lib/arr-rate-limiter";
import { LogSource } from "@/shared/types/models";
import type { Instance } from "@/shared/types/models";
import type { ReleaseCandidate } from "@/shared/types/api";

// Servarr's ReleaseResource is identical across Radarr and Sonarr, so the
// upstream shape + the projection to our ReleaseCandidate live here on the
// base and both subclasses reuse them. Only the fields the picker renders
// are kept. Per-CF scores aren't carried by the release payload (score is
// profile-relative); the prominent decision number is the upstream
// `customFormatScore` total, which the *arr already computed against the
// item's quality profile.
export interface UpstreamRelease {
  guid: string;
  indexerId?: number;
  indexer?: string;
  title: string;
  protocol?: string;
  quality?: { quality?: { name?: string } };
  size?: number;
  seeders?: number | null;
  ageHours?: number;
  customFormats?: Array<{ id: number; name: string }>;
  customFormatScore?: number;
  rejections?: string[];
  downloadAllowed?: boolean;
}

export function mapReleaseCandidate(r: UpstreamRelease): ReleaseCandidate {
  return {
    guid: r.guid,
    indexerId: r.indexerId ?? 0,
    indexer: r.indexer ?? "",
    title: r.title,
    protocol: r.protocol === "usenet" ? "usenet" : "torrent",
    quality: r.quality?.quality?.name ?? "Unknown",
    size: r.size ?? 0,
    seeders: r.seeders ?? null,
    ageHours: r.ageHours,
    customFormats: (r.customFormats ?? []).map((cf) => ({
      id: cf.id,
      name: cf.name,
    })),
    customFormatScore: r.customFormatScore ?? 0,
    rejections: r.rejections ?? [],
    downloadAllowed: r.downloadAllowed ?? false,
  };
}

// Node's fetch wraps the underlying network error and surfaces a generic
// "fetch failed" message. The real diagnostic (ECONNREFUSED / ENOTFOUND /
// ETIMEDOUT / TLS errors) is on `error.cause`. Pull it forward so the user
// sees something actionable in the log context.
//
// Exported for any caller that runs ArrClient methods inside its own
// try/catch and wants the same human-readable rendering — e.g. the
// statusPoller worker, which logs per-instance fetch failures and
// would otherwise just record "fetch failed" with no clue what
// actually went wrong upstream.
export function describeFetchError(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const cause = (e as Error & { cause?: unknown }).cause;
  if (cause instanceof Error) {
    const code = (cause as Error & { code?: string }).code;
    return code ? `${cause.message} (${code})` : cause.message;
  }
  return e.message;
}

// True when an error came from talking to the upstream *arr (a non-2xx
// response, an aborted/timed-out request, or a network failure) rather than
// from Refinarr's own logic. Lets routes return 502 ("your *arr is down")
// instead of an opaque 500. Network failures are Node's "fetch failed"
// TypeError (real cause on `.cause`); timeouts surface as AbortError.
export function isUpstreamError(e: unknown): boolean {
  if (e instanceof ArrHttpError) return true;
  if (e instanceof Error) {
    if (e.name === "AbortError") return true;
    if (e.name === "TypeError" && /fetch failed/i.test(e.message)) return true;
    if ((e as Error & { cause?: unknown }).cause instanceof Error) return true;
  }
  return false;
}

// Typed HTTP-status error for upstream *arr non-2xx responses. Carries
// the status code so callers can discriminate (e.g. `getCommandById`
// swallows 404 but rethrows 5xx / 401 to surface real outages).
// Subclassing Error keeps `instanceof Error` checks elsewhere intact;
// the message format stays the same as the pre-typed throw so any
// `ActionLog.error` strings that captured it remain stable.
class ArrHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ArrHttpError";
  }
}

// 10 s is generous for a LAN-hosted *arr instance. Without a bound,
// an unreachable instance causes fetch() to hang until the OS-level TCP
// timeout fires (minutes), which blocks DataCache.rebuild() and makes
// the dashboard skeleton spin forever.
const ARR_FETCH_TIMEOUT_MS = 10_000;

// Interactive-search release queries hit the indexers live and routinely
// take far longer than a normal LAN call — Servarr's own UI waits ~30-60s.
// Override the default ceiling for `getReleases` only; every other call
// keeps the tight 10s bound.
export const RELEASE_FETCH_TIMEOUT_MS = 90_000;

// Bounded fetch — pageSize 200, single page only. Stale event windows
// resolve via `since` filtering; we never paginate the upstream's full
// history (avoids unbounded memory + wall-clock).
const HISTORY_PAGE_SIZE = 200;

// The /history endpoint has an awkward asymmetry: query params accept
// `eventType` as integer enum codes ONLY, but the response body
// serializes the same enum as its string name. The mapper below is
// the one place that knows both sides — Object.keys gives the strings
// the response uses, Object.values gives the codes the query needs.
//
// Codes from Servarr's HistoryEventType.cs (stable + identical across
// Radarr and Sonarr). Adding a new lifecycle event = add one line here
// and one branch in `nextStatusFor`.
export const LIFECYCLE_EVENT_TYPES = {
  grabbed: 1,
  downloadFolderImported: 3,
  downloadFailed: 4,
} as const;

export type LifecycleEventType = keyof typeof LIFECYCLE_EVENT_TYPES;

// Built from the mapper so the URL and the state machine can never
// drift — change a code or add an event in one place and both update.
const HISTORY_EVENT_FILTER = Object.values(LIFECYCLE_EVENT_TYPES)
  .map((code) => `&eventType=${code}`)
  .join("");

// Servarr's CommandResource is shared across Radarr/Sonarr/etc. — same
// shape, same fields. The narrow projection below covers everything
// statusPoller's command sync needs. Field reference:
//   https://radarr.video/docs/api/#/Command
interface UpstreamCommandRecord {
  id: number;
  name: string;
  status: "queued" | "started" | "completed" | "failed" | "aborted";
  started?: string | null;
  ended?: string | null;
  body?: { completionMessage?: string | null; message?: string | null };
}

function projectCommand(r: UpstreamCommandRecord): UpstreamCommand {
  return {
    id: r.id,
    name: r.name,
    status: r.status,
    started: r.started ?? null,
    ended: r.ended ?? null,
    body: r.body
      ? {
          completionMessage: r.body.completionMessage ?? null,
          message: r.body.message ?? null,
        }
      : undefined,
  };
}

// Universal fields every Servarr HistoryResource carries. The per-arr
// id fields (movieId / seriesId / episodeId) are typed loosely here
// because the base loop only needs the universal set; subclasses read
// the right id field in `projectHistoryRecord`.
export interface UpstreamHistoryRecord {
  id: number;
  eventType: string;
  date: string;
  sourceTitle: string | null;
  downloadId?: string | null;
  movieId?: number;
  seriesId?: number;
  episodeId?: number;
}

export abstract class ArrClient {
  protected readonly baseUrl: string;
  protected readonly apiKey: string;
  protected readonly instanceName: string;
  protected readonly instanceId: number;

  // The `appName` this *arr's /system/status must report (Radarr → "Radarr",
  // Sonarr → "Sonarr"). Used by testConnection to reject a URL that points at
  // the wrong product, which otherwise connects fine (both serve /api/v3) and
  // silently creates a mistyped instance.
  protected abstract readonly expectedAppName: string;

  constructor(instance: Instance) {
    // Defense in depth: even if a row was tampered with, refuse to fetch
    // unsafe URLs. The primary check happens at write time in InstanceService.
    assertSafeArrUrl(instance.url);
    this.baseUrl = instance.url.replace(/\/$/, "");
    this.apiKey = instance.apiKey;
    this.instanceName = instance.name;
    this.instanceId = instance.id;
  }

  // Raw request scaffolding shared by the JSON `fetch` and the binary
  // `fetchImage` paths: builds the URL, enforces the 10s ceiling even
  // when the caller passes its own signal, and acquires a rate-limit
  // token INSIDE that timeout window (a stuck bucket would otherwise
  // hang indefinitely before the AbortController is even constructed).
  //
  // AbortSignal.any() isn't available until Node 22; for broader
  // compatibility we compose manually — the timeout fires after
  // ARR_FETCH_TIMEOUT_MS and a caller abort propagates immediately, with
  // the timeout cleared either way. Returns the raw Response unchecked;
  // callers own the !ok handling and body decoding.
  private async performFetch(
    path: string,
    init?: RequestInit,
    timeoutMs: number = ARR_FETCH_TIMEOUT_MS,
  ): Promise<Response> {
    const url = `${this.baseUrl}/api/v3${path}`;
    const ac = new AbortController();
    const timeoutId = setTimeout(
      () => ac.abort(new DOMException("TimeoutError", "TimeoutError")),
      timeoutMs,
    );
    let onCallerAbort: (() => void) | undefined;
    if (init?.signal) {
      if (init.signal.aborted) {
        clearTimeout(timeoutId);
        ac.abort(init.signal.reason);
      } else {
        onCallerAbort = () => {
          clearTimeout(timeoutId);
          ac.abort(init.signal!.reason);
        };
        init.signal.addEventListener("abort", onCallerAbort, { once: true });
      }
    }

    try {
      await arrRateLimiter.acquire(this.instanceId, ac.signal);
      return await globalThis.fetch(url, {
        ...init,
        signal: ac.signal,
        headers: {
          "X-Api-Key": this.apiKey,
          ...init?.headers,
        },
      });
    } finally {
      clearTimeout(timeoutId);
      if (onCallerAbort)
        init?.signal?.removeEventListener("abort", onCallerAbort);
    }
  }

  protected async fetch<T>(
    path: string,
    init?: RequestInit,
    timeoutMs?: number,
  ): Promise<T> {
    const res = await this.performFetch(
      path,
      {
        ...init,
        headers: { "Content-Type": "application/json", ...init?.headers },
      },
      timeoutMs,
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      appLogger.warn(`Arr API error: ${this.instanceName}`, {
        source: LogSource.ArrClient,
        context: {
          instance: this.instanceName,
          url: `${this.baseUrl}/api/v3${path}`,
          status: res.status,
          body: redactString(text).slice(0, 500),
        },
      });
      throw new ArrHttpError(
        `${this.instanceName} API error: ${res.status}`,
        res.status,
      );
    }

    const ct = res.headers.get("content-type") ?? "";
    const len = res.headers.get("content-length");
    if (!ct.includes("application/json") || len === "0") return undefined as T;
    return res.json() as Promise<T>;
  }

  // Binary sibling of `fetch` for image endpoints (poster art). Same
  // SSRF guard (baseUrl validated in the constructor), rate-limit, and
  // timeout, but returns the raw Response WITHOUT forcing a JSON
  // Content-Type or parsing the body — the caller streams `res.body`
  // and copies the upstream `content-type`. Returns the Response even
  // on a non-2xx so the caller can map it (e.g. a 404 = "no poster" →
  // placeholder) rather than throwing.
  //
  // NOTE: the 10s timeout bounds the connect + headers phase only (it's
  // cleared once the Response resolves). Body streaming is unbounded by
  // this timeout; pass the route's `signal` so a client disconnect
  // during the header phase still aborts the upstream fetch.
  protected async fetchImage(
    path: string,
    init?: RequestInit,
  ): Promise<Response> {
    return this.performFetch(path, init);
  }

  // Stream a media item's poster art. Both Radarr and Sonarr expose the
  // same `/mediacover/{id}/poster.jpg` endpoint, so the projection lives
  // here on the base. The route returns the stream same-origin (CSP
  // unchanged) behind the auth proxy, with the instance API key never
  // reaching the browser.
  async getPosterStream(
    mediaId: number,
    init?: RequestInit,
  ): Promise<Response> {
    return this.fetchImage(`/mediacover/${mediaId}/poster.jpg`, init);
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      const status = await this.fetch<{ appName?: string }>("/system/status");
      // Reject a wrong-product URL (e.g. a Sonarr URL saved as a Radarr
      // instance): both reply 200 on /api/v3/system/status, so without this
      // the mismatch is silently accepted. Only reject on an explicit
      // mismatch — tolerate an absent appName (older/unknown builds).
      const appName = status?.appName;
      if (appName && appName !== this.expectedAppName) {
        return {
          ok: false,
          error: `URL points to ${appName}, expected ${this.expectedAppName}`,
        };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: describeFetchError(e) };
    }
  }

  async getCustomFormats(): Promise<Array<{ id: number; name: string }>> {
    return this.fetch<Array<{ id: number; name: string }>>("/customformat");
  }

  abstract getQualityProfiles(): Promise<
    Array<{ id: number; name: string; minUpgradeFormatScore: number }>
  >;

  // Trigger an item-level search. Item is whatever the *arr considers the
  // primary unit — movie / series / album / scene. Each subclass posts the
  // appropriate command to /command. Service action methods can call this
  // through an `ArrClient`-typed reference (no `as RadarrClient` cast).
  // Returns the upstream command id parsed from the /command response,
  // which the service stamps onto the ActionLog row as the join key for
  // future lifecycle status updates (webhook / polling).
  abstract triggerSearch(itemId: number): Promise<{ commandId: number }>;

  // Delete a file from the *arr's library. Each subclass routes to the
  // right endpoint (Radarr's /moviefile/{id}, Sonarr's /episodefile/{id},
  // etc.). Returns once the upstream confirms the delete; a follow-up
  // search (if requested) is the caller's job.
  abstract deleteFile(fileId: number): Promise<void>;

  // Command sync: snapshot of the upstream command queue. The shape
  // is shared across every Servarr fork so the projection lives here;
  // statusPoller matches by `id` against `ActionLog.commandId`
  // (composite-indexed (instanceId, commandId)) so we can surface the
  // search outcome ("0 releases found", "Sent 1 release(s)...") without
  // per-action polling.
  async getRecentCommands(): Promise<UpstreamCommand[]> {
    const records = await this.fetch<UpstreamCommandRecord[]>("/command");
    return records.map((r) => projectCommand(r));
  }

  // Fallback for commands that aged out of `/command`'s recent window.
  // On a busy *arr (frequent ProcessMonitoredDownloads /
  // RefreshMonitoredDownloads), a search command dispatched ~20+
  // commands ago will no longer appear in the recent list — without
  // a per-id fallback the status poller never observes its outcome
  // and the ActionLog row stays stuck at "searched".
  //
  // Returns null only for the two cases where "the row's outcome is
  // genuinely unobservable right now":
  //   - 404: command has been GC'd by the *arr; nothing to fetch.
  //   - Network/transport failure (TypeError from Node fetch, AbortError
  //     from the timeout guard): retry next tick.
  // 5xx / 401 / 403 / other non-2xx rethrow so an actual upstream
  // outage or auth break surfaces in the poller's error path instead
  // of silently leaving rows stuck.
  async getCommandById(id: number): Promise<UpstreamCommand | null> {
    try {
      const r = await this.fetch<UpstreamCommandRecord>(`/command/${id}`);
      return r ? projectCommand(r) : null;
    } catch (err) {
      if (err instanceof ArrHttpError && err.status === 404) return null;
      if (err instanceof TypeError) return null;
      if (err instanceof DOMException && err.name === "AbortError") return null;
      throw err;
    }
  }

  // History sync: media-event history bounded by `since` so we don't
  // reprocess the same events tick-after-tick. The fetch + filter loop
  // lives here; subclasses only own the per-arr `mediaId/scope`
  // projection via `projectHistoryRecord`.
  async getRecentHistory(since: Date): Promise<UpstreamHistoryEvent[]> {
    const sinceMs = since.getTime();
    const page = await this.fetch<{ records: UpstreamHistoryRecord[] }>(
      `/history?page=1&pageSize=${HISTORY_PAGE_SIZE}&sortKey=date&sortDirection=descending${HISTORY_EVENT_FILTER}`,
    );
    const out: UpstreamHistoryEvent[] = [];
    for (const r of page.records ?? []) {
      const d = Date.parse(r.date);
      if (Number.isFinite(d) && d < sinceMs) continue;
      const tag = this.projectHistoryRecord(r);
      if (!tag) continue;
      out.push({
        id: r.id,
        mediaId: tag.mediaId,
        scope: tag.scope,
        eventType: r.eventType,
        date: r.date,
        sourceTitle: r.sourceTitle,
        downloadId: r.downloadId ?? null,
      });
    }
    return out;
  }

  // Subclass hook: project the per-arr id field(s) into the uniform
  // `mediaId + scope` shape statusPoller correlates against. Return
  // null to skip a record (e.g. one with no id field populated).
  protected abstract projectHistoryRecord(
    record: UpstreamHistoryRecord,
  ): { mediaId: number; scope: UpstreamHistoryEvent["scope"] } | null;
}

// Command-sync response shape — narrow projection of Radarr/Sonarr's
// CommandResource. We only care about the fields that drive status
// transitions; QualityModel / Language / etc. are dropped. `started`
// is the upstream-side timestamp the command actually began executing
// (per the Servarr API: https://radarr.video/docs/api/#/Command); we
// use it to bound history-event correlation when synthesizing a
// completionMessage.
export interface UpstreamCommand {
  id: number;
  name: string;
  status: "queued" | "started" | "completed" | "failed" | "aborted";
  started?: string | null;
  ended?: string | null;
  body?: { completionMessage?: string | null; message?: string | null };
}

// History-sync response shape — narrow projection of HistoryResource. We
// normalize the upstream's varied id fields into a single mediaId +
// `scope` discriminator so the service-side correlation logic stays
// per-arr-agnostic.
export interface UpstreamHistoryEvent {
  id: number;
  mediaId: number;
  scope: "movie" | "series" | "episode";
  eventType:
    | "grabbed"
    | "downloadFolderImported"
    | "downloadFailed"
    | "downloadIgnored"
    | string;
  date: string;
  sourceTitle: string | null;
  downloadId?: string | null;
}
