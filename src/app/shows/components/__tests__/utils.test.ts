import { describe, test, expect } from "vitest";
import type { EpisodeFileEntry } from "@/shared/types/models";
import { groupBySeason, filename } from "@/app/shows/components/utils";

function ep(
  id: number,
  season: number,
  path = `S${season}E${id}.mkv`,
): EpisodeFileEntry {
  return {
    id,
    seasonNumber: season,
    relativePath: path,
    customFormats: [],
    customFormatScore: 0,
    missingFormats: [],
    unwantedFormats: [],
    size: 0,
  };
}

describe("groupBySeason", () => {
  test("groups files by seasonNumber", () => {
    const files = [ep(1, 1), ep(2, 1), ep(3, 2)];
    const map = groupBySeason(files);
    expect(map.get(1)).toHaveLength(2);
    expect(map.get(2)).toHaveLength(1);
  });

  test("empty array returns empty map", () => {
    expect(groupBySeason([])).toEqual(new Map());
  });

  test("all same season produces one entry", () => {
    const files = [ep(1, 3), ep(2, 3), ep(3, 3)];
    const map = groupBySeason(files);
    expect(map.size).toBe(1);
    expect(map.get(3)).toHaveLength(3);
  });

  test("season 0 (specials) is grouped correctly", () => {
    const files = [ep(1, 0), ep(2, 1)];
    const map = groupBySeason(files);
    expect(map.get(0)).toHaveLength(1);
    expect(map.get(1)).toHaveLength(1);
  });

  test("preserves insertion order within a season", () => {
    const files = [ep(1, 1), ep(3, 1), ep(2, 1)];
    const map = groupBySeason(files);
    const season1 = map.get(1)!;
    expect(season1[0].id).toBe(1);
    expect(season1[1].id).toBe(3);
    expect(season1[2].id).toBe(2);
  });
});

describe("filename", () => {
  test("returns the last path segment", () => {
    expect(filename("Season 1/Episode 1.mkv")).toBe("Episode 1.mkv");
  });

  test("returns the string itself when no slash", () => {
    expect(filename("Episode.mkv")).toBe("Episode.mkv");
  });

  test("handles deeply nested path", () => {
    expect(filename("a/b/c/d.mkv")).toBe("d.mkv");
  });

  test("trailing slash returns empty string (pop of empty segment)", () => {
    // split("a/").pop() === ""
    expect(filename("path/")).toBe("");
  });

  test("empty string returns empty string", () => {
    expect(filename("")).toBe("");
  });
});
