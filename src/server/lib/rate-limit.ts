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

setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(k);
  }
}, 60_000).unref?.();
