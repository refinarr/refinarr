import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { formatRelative, formatEta } from "@/client/lib/format-relative";

const NOW = 1_700_000_000_000;

// Minimal stand-in for useTranslations("time") that mirrors en.json exactly.
function t(key: string, values?: Record<string, string | number>): string {
  const n = values?.n;
  const m = values?.m;
  switch (key) {
    case "unknown": return "unknown";
    case "secondsAgo": return `${n}s ago`;
    case "minutesAgo": return `${n}m ago`;
    case "hoursAgo": return `${n}h ago`;
    case "daysAgo": return `${n}d ago`;
    case "etaNow": return "now";
    case "etaLessThanMinute": return "<1m";
    case "etaMinutes": return `${n}m`;
    case "etaHours": return `${n}h`;
    case "etaHoursMinutes": return `${n}h ${m}m`;
    default: return key;
  }
}

describe("formatRelative", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("seconds for differences under 60s", () => {
    expect(formatRelative(NOW - 5_000, t)).toBe("5s ago");
    expect(formatRelative(NOW - 59_000, t)).toBe("59s ago");
  });

  test("minutes between 60s and 60m", () => {
    expect(formatRelative(NOW - 60_000, t)).toBe("1m ago");
    expect(formatRelative(NOW - 30 * 60_000, t)).toBe("30m ago");
  });

  test("hours between 1h and 24h", () => {
    expect(formatRelative(NOW - 3 * 60 * 60_000, t)).toBe("3h ago");
    expect(formatRelative(NOW - 23 * 60 * 60_000, t)).toBe("23h ago");
  });

  test("days for differences > 24h", () => {
    expect(formatRelative(NOW - 2 * 24 * 60 * 60_000, t)).toBe("2d ago");
  });

  test("clamps negative offsets to 0s", () => {
    expect(formatRelative(NOW + 5_000, t)).toBe("0s ago");
  });

  test("accepts Date instance", () => {
    expect(formatRelative(new Date(NOW - 10_000), t)).toBe("10s ago");
  });

  test("accepts ISO string", () => {
    const iso = new Date(NOW - 30_000).toISOString();
    expect(formatRelative(iso, t)).toBe("30s ago");
  });
});

describe("formatEta", () => {
  test("returns 'now' for zero or negative", () => {
    expect(formatEta(0, t)).toBe("now");
    expect(formatEta(-5_000, t)).toBe("now");
  });

  test("returns '<1m' for sub-minute values", () => {
    expect(formatEta(30_000, t)).toBe("<1m");
    expect(formatEta(59_999, t)).toBe("<1m");
  });

  test("minutes under 60", () => {
    expect(formatEta(5 * 60_000, t)).toBe("5m");
  });

  test("hours when whole", () => {
    expect(formatEta(2 * 60 * 60_000, t)).toBe("2h");
  });

  test("hours and minutes when not whole", () => {
    expect(formatEta(1 * 60 * 60_000 + 30 * 60_000, t)).toBe("1h 30m");
  });
});
