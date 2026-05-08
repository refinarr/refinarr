import { describe, test, expect } from "vitest";
import { describeFetchError } from "@/server/clients/ArrClient";

// Node's fetch wraps every network failure as `TypeError: fetch failed`,
// hiding the real cause on `error.cause`. The statusPoller worker logs
// per-instance fetch failures via this helper so /logs entries name the
// actual diagnostic ("ECONNREFUSED" / "ENOTFOUND" / etc.) instead of
// the useless wrapper. A miss here = silent regression in user-facing
// observability — worth a few cheap tests.
describe("describeFetchError", () => {
  test("unwraps Node fetch's `cause` and includes its code", () => {
    const cause = Object.assign(new Error("connect ECONNREFUSED 1.2.3.4:80"), {
      code: "ECONNREFUSED",
    });
    const wrapped = Object.assign(new TypeError("fetch failed"), { cause });
    expect(describeFetchError(wrapped)).toBe(
      "connect ECONNREFUSED 1.2.3.4:80 (ECONNREFUSED)",
    );
  });

  test("falls back to cause.message when no code is present", () => {
    const cause = new Error("DNS lookup failed");
    const wrapped = Object.assign(new TypeError("fetch failed"), { cause });
    expect(describeFetchError(wrapped)).toBe("DNS lookup failed");
  });

  test("returns the outer message when there is no cause", () => {
    expect(describeFetchError(new Error("AbortError"))).toBe("AbortError");
  });

  test("stringifies non-Error throwables (defensive)", () => {
    expect(describeFetchError("boom")).toBe("boom");
    expect(describeFetchError({ weird: true })).toBe("[object Object]");
  });
});
