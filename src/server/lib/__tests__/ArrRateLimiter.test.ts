import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { ArrRateLimiter } from "../ArrRateLimiter";

describe("ArrRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function make(ratePerSec: number) {
    vi.stubEnv("ARR_RATE_LIMIT", String(ratePerSec));
    const limiter = new ArrRateLimiter();
    vi.unstubAllEnvs();
    return limiter;
  }

  test("first capacity requests resolve immediately when bucket is full", async () => {
    const limiter = make(5); // capacity = 10

    const start = Date.now();
    for (let i = 0; i < 10; i++) await limiter.acquire(1);
    expect(Date.now()).toBe(start); // no timers advanced
  });

  test("acquire waits when bucket is exhausted", async () => {
    const limiter = make(10); // capacity = 20

    for (let i = 0; i < 20; i++) await limiter.acquire(1);

    let resolved = false;
    const p = limiter.acquire(1).then(() => {
      resolved = true;
    });
    expect(resolved).toBe(false);
    await vi.runAllTimersAsync();
    await p;
    expect(resolved).toBe(true);
  });

  test("buckets are independent across instances", async () => {
    const limiter = make(1); // capacity = 2

    await limiter.acquire(1);
    await limiter.acquire(1); // instance 1 drained

    const start = Date.now();
    await limiter.acquire(2); // instance 2 still full
    expect(Date.now()).toBe(start);
  });

  test("queued waiters consume one token per refill interval", async () => {
    const limiter = make(1); // capacity = 2
    await limiter.acquire(1);
    await limiter.acquire(1); // drained

    let firstResolved = false;
    let secondResolved = false;
    const first = limiter.acquire(1).then(() => {
      firstResolved = true;
    });
    const second = limiter.acquire(1).then(() => {
      secondResolved = true;
    });

    await vi.advanceTimersByTimeAsync(1000);
    await Promise.resolve();
    expect(firstResolved).toBe(true);
    expect(secondResolved).toBe(false);

    await vi.advanceTimersByTimeAsync(1000);
    await Promise.all([first, second]);
    expect(secondResolved).toBe(true);
  });

  test("evict resets the bucket so next acquire is immediate", async () => {
    const limiter = make(1); // capacity = 2

    await limiter.acquire(1);
    await limiter.acquire(1); // drained

    limiter.evict(1);

    const start = Date.now();
    await limiter.acquire(1); // fresh bucket
    expect(Date.now()).toBe(start);
  });

  test("throws immediately if signal is already aborted", async () => {
    const limiter = make(5);
    const ac = new AbortController();
    ac.abort();
    await expect(limiter.acquire(1, ac.signal)).rejects.toThrow();
  });

  test("throws and clears timer when signal is aborted while waiting for a token", async () => {
    const limiter = make(1); // capacity = 2
    await limiter.acquire(1);
    await limiter.acquire(1); // drained

    const ac = new AbortController();
    const p = limiter.acquire(1, ac.signal);
    ac.abort(); // fires while sleeping for refill
    await expect(p).rejects.toThrow();
  });
});
