import { describe, test, expect } from "vitest";
import { getSeverity } from "@/client/lib/severity";

describe("getSeverity — hasFile=false (missing)", () => {
  test("returns 'missing' when hasFile is false regardless of score", () => {
    expect(getSeverity(1, undefined, false)).toBe("missing");
    expect(getSeverity(0.9, 100, false)).toBe("missing");
    expect(getSeverity(0, undefined, false)).toBe("missing");
  });
});

describe("getSeverity — positive target (profile cutoff)", () => {
  const target = 100;

  test("negative score is critical", () => {
    expect(getSeverity(-1, target)).toBe("critical");
  });

  test("score below 33% of target is low", () => {
    expect(getSeverity(32, target)).toBe("low");
  });

  test("score at exactly 33% boundary falls into warning (exclusive boundary)", () => {
    expect(getSeverity(33, target)).toBe("warning");
  });

  test("score above 33% but below 75% is warning", () => {
    expect(getSeverity(50, target)).toBe("warning");
  });

  test("score at 75% boundary is warning (exclusive)", () => {
    expect(getSeverity(74, target)).toBe("warning");
  });

  test("score at or above 75% is ok", () => {
    expect(getSeverity(75, target)).toBe("ok");
    expect(getSeverity(100, target)).toBe("ok");
    expect(getSeverity(200, target)).toBe("ok");
  });
});

describe("getSeverity — no cutoff (fallback thresholds)", () => {
  // target undefined or <= 0 → `target > 0` is false → coarse 0.3/0.6/0.85
  // buckets apply.
  test("falls back when target is 0", () => {
    expect(getSeverity(0, 0)).toBe("critical");
    expect(getSeverity(0.9, 0)).toBe("ok");
  });

  test("falls back when target is undefined", () => {
    expect(getSeverity(0, undefined)).toBe("critical");
    expect(getSeverity(0.29, undefined)).toBe("critical");
    expect(getSeverity(0.3, undefined)).toBe("low");
    expect(getSeverity(0.5, undefined)).toBe("low");
    expect(getSeverity(0.6, undefined)).toBe("warning");
    expect(getSeverity(0.7, undefined)).toBe("warning");
    expect(getSeverity(0.85, undefined)).toBe("ok");
    expect(getSeverity(1, undefined)).toBe("ok");
  });
});
