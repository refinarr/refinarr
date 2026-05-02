import { describe, test, expect } from "vitest";
import { getSeverity } from "@/client/lib/severity";

describe("getSeverity — hasFile=false (missing)", () => {
  test("returns 'missing' when hasFile is false regardless of score", () => {
    expect(getSeverity(1, undefined, "manual", false)).toBe("missing");
    expect(getSeverity(0.9, 100, "profile", false)).toBe("missing");
    expect(getSeverity(0, undefined, "manual", false)).toBe("missing");
  });
});

describe("getSeverity — profile mode with positive target", () => {
  const target = 100;

  test("negative score is critical", () => {
    expect(getSeverity(-1, target, "profile")).toBe("critical");
  });

  test("score below 33% of target is low", () => {
    expect(getSeverity(32, target, "profile")).toBe("low");
  });

  test("score strictly below 33% of target is low", () => {
    expect(getSeverity(32, target, "profile")).toBe("low");
  });

  test("score at exactly 33% boundary falls into warning (exclusive boundary)", () => {
    expect(getSeverity(33, target, "profile")).toBe("warning");
  });

  test("score above 33% but below 75% is warning", () => {
    expect(getSeverity(50, target, "profile")).toBe("warning");
  });

  test("score at 75% boundary is warning (exclusive)", () => {
    expect(getSeverity(74, target, "profile")).toBe("warning");
  });

  test("score at or above 75% is ok", () => {
    expect(getSeverity(75, target, "profile")).toBe("ok");
    expect(getSeverity(100, target, "profile")).toBe("ok");
    expect(getSeverity(200, target, "profile")).toBe("ok");
  });
});

describe("getSeverity — profile mode with target === 0 (no cutoff)", () => {
  test("falls through to manual thresholds when target is 0", () => {
    // target === 0 means `target > 0` is false → uses manual thresholds
    expect(getSeverity(0, 0, "profile")).toBe("critical");
    expect(getSeverity(0.9, 0, "profile")).toBe("ok");
  });

  test("falls through to manual thresholds when target is undefined", () => {
    expect(getSeverity(0, undefined, "profile")).toBe("critical");
    expect(getSeverity(0.9, undefined, "profile")).toBe("ok");
  });
});

describe("getSeverity — manual mode", () => {
  test("score < 0.3 is critical", () => {
    expect(getSeverity(0, undefined, "manual")).toBe("critical");
    expect(getSeverity(0.29, undefined, "manual")).toBe("critical");
  });

  test("score at 0.3 boundary is low", () => {
    expect(getSeverity(0.3, undefined, "manual")).toBe("low");
  });

  test("score in [0.3, 0.6) is low", () => {
    expect(getSeverity(0.5, undefined, "manual")).toBe("low");
  });

  test("score at 0.6 boundary is warning", () => {
    expect(getSeverity(0.6, undefined, "manual")).toBe("warning");
  });

  test("score in [0.6, 0.85) is warning", () => {
    expect(getSeverity(0.7, undefined, "manual")).toBe("warning");
  });

  test("score at 0.85 boundary is ok", () => {
    expect(getSeverity(0.85, undefined, "manual")).toBe("ok");
  });

  test("score >= 0.85 is ok", () => {
    expect(getSeverity(1, undefined, "manual")).toBe("ok");
  });
});
