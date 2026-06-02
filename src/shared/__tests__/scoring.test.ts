import { describe, test, expect } from "vitest";
import { isBelowProfileScore, scoreProfileCoverage } from "@/shared/scoring";

describe("isBelowProfileScore", () => {
  test("minScore === 0 always returns false", () => {
    expect(isBelowProfileScore(0, 0)).toBe(false);
    expect(isBelowProfileScore(-100, 0)).toBe(false);
    expect(isBelowProfileScore(1000, 0)).toBe(false);
  });

  test("currentScore < minScore returns true", () => {
    expect(isBelowProfileScore(50, 100)).toBe(true);
    expect(isBelowProfileScore(-1, 1)).toBe(true);
  });

  test("currentScore === minScore returns false (equal is not below)", () => {
    expect(isBelowProfileScore(100, 100)).toBe(false);
  });

  test("currentScore > minScore returns false", () => {
    expect(isBelowProfileScore(150, 100)).toBe(false);
  });

  test("negative currentScore with positive minScore returns true", () => {
    expect(isBelowProfileScore(-50, 1)).toBe(true);
  });
});

describe("scoreProfileCoverage", () => {
  test("minScore === 0 always returns 1", () => {
    expect(scoreProfileCoverage(0, 0)).toBe(1);
    expect(scoreProfileCoverage(-999, 0)).toBe(1);
    expect(scoreProfileCoverage(999, 0)).toBe(1);
  });

  test("currentScore === minScore returns 1", () => {
    expect(scoreProfileCoverage(100, 100)).toBe(1);
  });

  test("currentScore > minScore is clamped to 1", () => {
    expect(scoreProfileCoverage(133, 100)).toBe(1);
  });

  test("currentScore < 0 is clamped to 0", () => {
    expect(scoreProfileCoverage(-50, 100)).toBe(0);
  });

  test("half coverage returns 0.5", () => {
    expect(scoreProfileCoverage(50, 100)).toBe(0.5);
  });

  test("returns correct ratio", () => {
    expect(scoreProfileCoverage(75, 100)).toBe(0.75);
  });
});
