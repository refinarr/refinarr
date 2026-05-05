import { describe, test, expect } from "vitest";
import {
  isMissingWantedFormats,
  getMissingFormats,
  scoreCfCoverage,
  isBelowProfileScore,
  scoreProfileCoverage,
} from "@/shared/scoring";
import type { CustomFormat } from "@/shared/types/models";

function cf(id: number, name = `CF${id}`): CustomFormat {
  return { id, name };
}

describe("isMissingWantedFormats", () => {
  test("empty wantedIds always returns false", () => {
    expect(isMissingWantedFormats([cf(1)], [])).toBe(false);
    expect(isMissingWantedFormats([], [])).toBe(false);
  });

  test("empty itemCfs with non-empty wantedIds returns true", () => {
    expect(isMissingWantedFormats([], [1, 2])).toBe(true);
  });

  test("all wanted IDs present returns false", () => {
    expect(isMissingWantedFormats([cf(1), cf(2), cf(3)], [1, 2, 3])).toBe(
      false,
    );
  });

  test("one wanted ID missing returns true", () => {
    expect(isMissingWantedFormats([cf(1), cf(2)], [1, 2, 3])).toBe(true);
  });

  test("duplicate IDs in wantedIds do not cause false positive", () => {
    expect(isMissingWantedFormats([cf(1)], [1, 1, 1])).toBe(false);
  });

  test("subset of wantedIds present returns true", () => {
    expect(isMissingWantedFormats([cf(1)], [1, 2])).toBe(true);
  });
});

describe("getMissingFormats", () => {
  test("returns empty array when all wanted are present", () => {
    expect(getMissingFormats([cf(1), cf(2)], [cf(1), cf(2)])).toEqual([]);
  });

  test("returns formats missing by id regardless of name", () => {
    const wanted = [{ id: 1, name: "Old Name" }];
    const result = getMissingFormats([], wanted);
    expect(result).toEqual(wanted);
  });

  test("empty wantedCfs returns empty array", () => {
    expect(getMissingFormats([cf(1)], [])).toEqual([]);
  });

  test("empty itemCfs returns all wantedCfs", () => {
    const wanted = [cf(1), cf(2)];
    expect(getMissingFormats([], wanted)).toEqual(wanted);
  });

  test("returns only missing ones", () => {
    expect(getMissingFormats([cf(1)], [cf(1), cf(2)])).toEqual([cf(2)]);
  });

  test("returned objects are the wantedCfs references", () => {
    const wanted = [cf(2)];
    const result = getMissingFormats([cf(1)], wanted);
    expect(result[0]).toBe(wanted[0]);
  });
});

describe("scoreCfCoverage", () => {
  test("empty wantedIds returns exactly 1", () => {
    expect(scoreCfCoverage([], [])).toBe(1);
    expect(scoreCfCoverage([cf(1)], [])).toBe(1);
  });

  test("all matched returns 1", () => {
    expect(scoreCfCoverage([cf(1), cf(2)], [1, 2])).toBe(1);
  });

  test("none matched returns 0", () => {
    expect(scoreCfCoverage([cf(1)], [2, 3])).toBe(0);
  });

  test("half matched returns 0.5", () => {
    expect(scoreCfCoverage([cf(1)], [1, 2])).toBe(0.5);
  });

  test("empty itemCfs returns 0", () => {
    expect(scoreCfCoverage([], [1, 2, 3])).toBe(0);
  });

  test("large list partial match", () => {
    const items = Array.from({ length: 999 }, (_, i) => cf(i + 1));
    const wanted = Array.from({ length: 1000 }, (_, i) => i + 1);
    expect(scoreCfCoverage(items, wanted)).toBe(0.999);
  });
});

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
