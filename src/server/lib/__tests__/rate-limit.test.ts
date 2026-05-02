import { describe, test, expect } from "vitest";
import { checkRateLimit, clientIp } from "@/server/lib/rate-limit";

// Use a unique key prefix per test to avoid bucket state pollution
// since the module exports a global Map that persists across tests.
let keyCounter = 0;
function uniqueKey(): string {
  return `test-ip-${Date.now()}-${keyCounter++}`;
}

describe("checkRateLimit", () => {
  test("first request is always allowed", () => {
    const result = checkRateLimit(uniqueKey(), { max: 5, windowMs: 60_000 });
    expect(result.allowed).toBe(true);
    expect(result.retryAfterMs).toBe(0);
  });

  test("requests within max are allowed", () => {
    const key = uniqueKey();
    const opts = { max: 3, windowMs: 60_000 };
    expect(checkRateLimit(key, opts).allowed).toBe(true);
    expect(checkRateLimit(key, opts).allowed).toBe(true);
    expect(checkRateLimit(key, opts).allowed).toBe(true);
  });

  test("request exceeding max is blocked", () => {
    const key = uniqueKey();
    const opts = { max: 3, windowMs: 60_000 };
    checkRateLimit(key, opts);
    checkRateLimit(key, opts);
    checkRateLimit(key, opts);
    const blocked = checkRateLimit(key, opts);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  test("retryAfterMs is within the window", () => {
    const key = uniqueKey();
    const opts = { max: 1, windowMs: 60_000 };
    checkRateLimit(key, opts);
    const blocked = checkRateLimit(key, opts);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
    expect(blocked.retryAfterMs).toBeLessThanOrEqual(60_000);
  });

  test("different keys have independent buckets", () => {
    const opts = { max: 1, windowMs: 60_000 };
    const key1 = uniqueKey();
    const key2 = uniqueKey();
    checkRateLimit(key1, opts);
    checkRateLimit(key1, opts); // key1 blocked
    const result = checkRateLimit(key2, opts); // key2 fresh
    expect(result.allowed).toBe(true);
  });

  test("window reset: new request after window expires is allowed", () => {
    const key = uniqueKey();
    // 1ms window so it expires immediately
    const opts = { max: 1, windowMs: 1 };
    checkRateLimit(key, opts); // uses up the slot

    // Wait for the window to expire
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const result = checkRateLimit(key, opts);
        expect(result.allowed).toBe(true);
        resolve();
      }, 10);
    });
  });
});

describe("clientIp", () => {
  function makeReq(headers: Record<string, string> = {}): Request {
    return new Request("http://localhost/x", { headers });
  }

  test("returns the first IP from x-forwarded-for", () => {
    expect(clientIp(makeReq({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("1.2.3.4");
  });

  test("trims whitespace from the IP", () => {
    expect(clientIp(makeReq({ "x-forwarded-for": "  1.2.3.4  " }))).toBe("1.2.3.4");
  });

  test("falls back to 'unknown' without x-forwarded-for", () => {
    expect(clientIp(makeReq())).toBe("unknown");
  });
});
