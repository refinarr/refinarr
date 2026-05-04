class TokenBucket {
  private tokens: number;
  private lastRefillMs: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerMs: number,
  ) {
    this.tokens = capacity;
    this.lastRefillMs = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    // Wait until one token is available, then consume it.
    const waitMs = Math.ceil((1 - this.tokens) / this.refillPerMs);
    await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
    this.refill();
    this.tokens = Math.max(0, this.tokens - 1);
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
 * Default: ARR_RATE_LIMIT req/sec (env, default 5). Burst allowance = 2×.
 * Buckets start full so the first N requests fire without delay.
 */
export class ArrRateLimiter {
  private readonly buckets = new Map<number, TokenBucket>();
  private readonly capacity: number;
  private readonly refillPerMs: number;

  constructor() {
    const parsed = Number(process.env.ARR_RATE_LIMIT);
    const ratePerSec = Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
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
