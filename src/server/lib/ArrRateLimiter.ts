class TokenBucket {
  private tokens: number;
  private lastRefillMs: number;
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private readonly capacity: number,
    private readonly refillPerMs: number,
  ) {
    this.tokens = capacity;
    this.lastRefillMs = Date.now();
  }

  async acquire(): Promise<void> {
    // Chain callers into a FIFO queue via promise tail — each caller waits
    // for the previous to finish before entering its own timing loop, so no
    // two callers race to consume the same refilled token.
    let release!: () => void;
    const prev = this.tail;
    this.tail = new Promise<void>((resolve) => { release = resolve; });

    await prev;
    try {
      while (true) {
        this.refill();
        if (this.tokens >= 1) {
          this.tokens -= 1;
          return;
        }
        const waitMs = Math.max(1, Math.ceil((1 - this.tokens) / this.refillPerMs));
        await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
      }
    } finally {
      release();
    }
  }

  private refill(): void {
    const now = Date.now();
    this.tokens = Math.min(this.capacity, this.tokens + this.refillPerMs * (now - this.lastRefillMs));
    this.lastRefillMs = now;
  }
}

/**
 * Per-instance outbound rate limiter for *arr API calls.
 * Prevents bulk ops from bursting the upstream server.
 *
 * Default: ARR_RATE_LIMIT req/sec (env, default 50). Burst allowance = 2×.
 * Buckets start full so the first N requests fire without delay.
 *
 * 50/sec is comfortable for a self-hosted Sonarr/Radarr — they have no
 * per-IP rate limits, the cap is just outbound politeness so a flagged-
 * library rebuild for a 100+ series instance doesn't take 30s.
 */
export class ArrRateLimiter {
  private readonly buckets = new Map<number, TokenBucket>();
  private readonly capacity: number;
  private readonly refillPerMs: number;

  constructor() {
    const parsed = Number(process.env.ARR_RATE_LIMIT);
    const configuredRate = Number.isFinite(parsed) && parsed > 0 ? parsed : 50;
    const ratePerSec = Math.max(1, configuredRate);
    this.refillPerMs = ratePerSec / 1000;
    this.capacity = ratePerSec * 2;
  }

  async acquire(instanceId: number): Promise<void> {
    let bucket = this.buckets.get(instanceId);
    if (!bucket) {
      bucket = new TokenBucket(this.capacity, this.refillPerMs);
      this.buckets.set(instanceId, bucket);
    }
    await bucket.acquire();
  }

  /** Remove the bucket when an instance is deleted — frees memory. */
  evict(instanceId: number): void {
    this.buckets.delete(instanceId);
  }
}

export const arrRateLimiter = new ArrRateLimiter();
