import { appLogger } from "@/server/lib/app-logger";
import { LogSource } from "@/shared/types/models";

export interface CachedRelease {
  tag: string;
  htmlUrl: string;
  fetchedAtMs: number;
}

// 6 h TTL keeps the process at ~4 GitHub requests/day. Well under
// GitHub's 60/hr unauthenticated rate-limit even with manual refreshes.
const TTL_MS = 6 * 60 * 60 * 1000;

// Overridable for forks that publish their own release feed.
const REPO = process.env.REFINARR_RELEASE_REPO ?? "iHX-Labs/refinarr";

let cached: CachedRelease | null = null;
let inFlight: Promise<CachedRelease | null> | null = null;

interface ReleaseResult {
  release: CachedRelease | null;
  // True when `release` was served from cache (or cached after a fetch
  // failure) past the TTL — the UI can show a "checked X ago" hint.
  isStale: boolean;
}

export function isCacheFresh(now = Date.now()): boolean {
  return cached !== null && now - cached.fetchedAtMs < TTL_MS;
}

interface GitHubReleasePayload {
  tag_name?: unknown;
  html_url?: unknown;
}

async function fetchFromGitHub(): Promise<CachedRelease | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/releases/latest`,
      {
        headers: {
          // GitHub requires a User-Agent for API requests.
          "User-Agent": "refinarr",
          Accept: "application/vnd.github+json",
        },
        // Hedge against a flaky upstream; 10s is plenty for a single API call.
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!res.ok) {
      // 404 = no published releases yet (fresh repo). Treat as "no
      // release info" instead of an error condition; UI shows "Update
      // check unavailable".
      appLogger.warn("GitHub release fetch returned non-2xx", {
        source: LogSource.Api,
        context: { repo: REPO, status: res.status },
      });
      return null;
    }
    const body = (await res.json()) as GitHubReleasePayload;
    const tag = typeof body.tag_name === "string" ? body.tag_name : null;
    const htmlUrl = typeof body.html_url === "string" ? body.html_url : null;
    if (!tag || !htmlUrl) return null;
    return { tag, htmlUrl, fetchedAtMs: Date.now() };
  } catch (err) {
    // Network failure / timeout / GitHub down. Don't throw — the
    // /settings/system page should still render. Caller falls back to
    // the previous cached value if any.
    appLogger.warn("GitHub release fetch failed", {
      source: LogSource.Api,
      err,
      context: { repo: REPO },
    });
    return null;
  }
}

/**
 * Get the latest published GitHub release tag for refinarr.
 *
 * - Cached for 6h; `force: true` bypasses the cache (manual refresh
 *   button on /settings/system).
 * - On fetch failure, returns the previously-cached value when one
 *   exists (stale-but-known beats blank). Caller distinguishes via
 *   `isStale`.
 * - Coalesces concurrent calls via a shared in-flight promise so a
 *   refresh button mash doesn't fire N requests.
 */
export async function getLatestRelease(opts?: {
  force?: boolean;
}): Promise<ReleaseResult> {
  if (!opts?.force && isCacheFresh()) {
    return { release: cached, isStale: false };
  }

  // Coalesce concurrent fetches. When the shared promise resolves null
  // (fetch failure), waiters must use the same stale-cache fallback the
  // initiator uses — otherwise they'd see `release: null` while the
  // initiator saw the prior cached value.
  if (inFlight) {
    const shared = await inFlight;
    if (shared) return { release: shared, isStale: false };
    return { release: cached, isStale: cached !== null };
  }

  inFlight = fetchFromGitHub().finally(() => {
    inFlight = null;
  });
  const fresh = await inFlight;
  if (fresh) {
    cached = fresh;
    return { release: fresh, isStale: false };
  }
  return { release: cached, isStale: cached !== null };
}

// Test-only escape hatch. Lets tests reset the module-level cache
// between specs without exporting `cached` itself.
export function __resetReleaseCacheForTests(): void {
  cached = null;
  inFlight = null;
}
