// @vitest-environment happy-dom
import { describe, test, expect } from "vitest";
import { safeRandomUUID } from "@/client/lib/uuid";

// RFC-4122 v4: 8-4-4-4-12 hex, version nibble `4`, variant nibble in [89ab].
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// Swap crypto.randomUUID for the duration of a SYNCHRONOUS body, then
// restore in the same tick. Never leave the global patched across an await:
// Prisma (used by the DB-backed global setup) also reads crypto.randomUUID.
function withRandomUUID<T>(value: unknown, body: () => T): T {
  const original = Object.getOwnPropertyDescriptor(crypto, "randomUUID");
  Object.defineProperty(crypto, "randomUUID", {
    value,
    configurable: true,
    writable: true,
  });
  try {
    return body();
  } finally {
    if (original) Object.defineProperty(crypto, "randomUUID", original);
  }
}

describe("safeRandomUUID", () => {
  test("uses crypto.randomUUID when available (secure context)", () => {
    withRandomUUID(
      () => "11111111-1111-4111-8111-111111111111",
      () =>
        expect(safeRandomUUID()).toBe("11111111-1111-4111-8111-111111111111"),
    );
  });

  test("falls back to getRandomValues when randomUUID is undefined (insecure HTTP context)", () => {
    // Simulate http://<lan-ip>, where crypto.randomUUID doesn't exist and
    // the old `crypto.randomUUID()` call threw a TypeError.
    withRandomUUID(undefined, () => expect(safeRandomUUID()).toMatch(UUID_V4));
  });

  test("fallback yields unique, well-formed ids across calls", () => {
    withRandomUUID(undefined, () => {
      const ids = new Set(Array.from({ length: 200 }, () => safeRandomUUID()));
      expect(ids.size).toBe(200);
      for (const id of ids) expect(id).toMatch(UUID_V4);
    });
  });
});
