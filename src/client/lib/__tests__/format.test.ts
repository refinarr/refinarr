import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { formatBytes, formatRelative } from "@/client/lib/format";

describe("formatBytes", () => {
  test("0 bytes returns em dash", () => {
    expect(formatBytes(0)).toBe("—");
  });

  test("falsy value returns em dash", () => {
    // The implementation uses `if (!bytes)` so NaN, undefined cast to number also return —
    expect(formatBytes(NaN)).toBe("—");
  });

  test("1 byte returns B unit", () => {
    expect(formatBytes(1)).toBe("1.0 B");
  });

  test("exact 1 KB", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
  });

  test("exact 1 MB", () => {
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
  });

  test("exact 1 GB", () => {
    expect(formatBytes(1024 ** 3)).toBe("1.0 GB");
  });

  test("exact 1 TB", () => {
    expect(formatBytes(1024 ** 4)).toBe("1.0 TB");
  });

  test("fractional GB formats to one decimal", () => {
    expect(formatBytes(1.5 * 1024 ** 3)).toBe("1.5 GB");
  });

  test("large value in GB range", () => {
    expect(formatBytes(50 * 1024 ** 3)).toBe("50.0 GB");
  });

  test("sub-KB value stays in B", () => {
    expect(formatBytes(512)).toBe("512.0 B");
  });
});

describe("formatRelative", () => {
  const NOW = new Date("2026-05-03T12:00:00Z").getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("under a minute renders in seconds", () => {
    expect(formatRelative(NOW - 30_000)).toMatch(/second/);
  });

  test("under an hour renders in minutes", () => {
    expect(formatRelative(NOW - 5 * 60_000)).toMatch(/minute/);
  });

  test("under a day renders in hours", () => {
    expect(formatRelative(NOW - 3 * 60 * 60_000)).toMatch(/hour/);
  });

  test("within a week renders in days", () => {
    expect(formatRelative(NOW - 2 * 24 * 60 * 60_000)).toMatch(/day/);
  });

  test("over a week falls back to a locale date string", () => {
    const out = formatRelative(NOW - 30 * 24 * 60 * 60_000);
    expect(out).not.toMatch(/(second|minute|hour|day|week)/);
    expect(out.length).toBeGreaterThan(0);
  });

  test("accepts a Date", () => {
    expect(formatRelative(new Date(NOW - 30_000))).toMatch(/second/);
  });

  test("accepts an ISO string", () => {
    expect(formatRelative(new Date(NOW - 30_000).toISOString())).toMatch(
      /second/,
    );
  });

  test("future timestamps render with positive direction", () => {
    expect(formatRelative(NOW + 60 * 60_000)).toMatch(/in/);
  });
});
