interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

interface Options {
  max: number;
  windowMs: number;
}

export function checkRateLimit(
  key: string,
  opts: Options,
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }
  if (existing.count >= opts.max) {
    return { allowed: false, retryAfterMs: existing.resetAt - now };
  }
  existing.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}

export function clientIp(req: Request): string {
  // We never use these headers for AUTH decisions — only for rate-limit bucketing,
  // which is a soft signal. The worst case for a spoofed header is the attacker
  // splits their own bucket, which doesn't help them.
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return "unknown";
}

let cleanupHandle: ReturnType<typeof setInterval> | null = null;

// Lifted out of module top-level so the timer registration is
// explicit (matches the searchWorker / statusPoller / autoRunner
// startup pattern) and so module import in test/build contexts
// doesn't spawn a stray interval. Called once from bootstrap.
export function startRateLimitCleanup(): void {
  if (cleanupHandle) return;
  cleanupHandle = setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(k);
    }
  }, 60_000);
  cleanupHandle.unref?.();
}

// Test hook — stop the timer so vitest can exit cleanly when the
// rate-limiter is exercised in unit tests.
export function stopRateLimitCleanup(): void {
  if (cleanupHandle) {
    clearInterval(cleanupHandle);
    cleanupHandle = null;
  }
}
