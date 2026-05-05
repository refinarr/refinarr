// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { FlaggedMedia, ScoringMode } from "@/shared/types/models";
import { useFlaggedMediaData } from "../useFlaggedMediaData";
import type { FlaggedMediaQueryHook } from "../useFlaggedMediaData";
import type { MediaFilters } from "../useMediaFilters";

type Item = FlaggedMedia;

const baseFilters: MediaFilters & { scoringMode: ScoringMode } = {
  sortBy: "score",
  order: "asc",
  maxScore: 1,
  q: "",
  profileId: null,
  missingCfIds: [],
  missingCfMatch: "all",
  hasNegativeCfIds: [],
  hasNegativeCfMatch: "all",
  onlyMissing: false,
  scoringMode: "manual",
};

function makeQueryHook(
  pages?: Array<{ items: Item[]; total: number }>,
  overrides: Partial<{
    isLoading: boolean;
    isError: boolean;
    isFetching: boolean;
    isFetchingNextPage: boolean;
    hasNextPage: boolean;
  }> = {},
): FlaggedMediaQueryHook<Item> {
  return () => ({
    data: pages ? { pages } : undefined,
    isLoading: false,
    isError: false,
    isFetching: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    refetch: vi.fn(),
    ...overrides,
  });
}

describe("useFlaggedMediaData", () => {
  function makeItem(id: number, title: string): Item {
    return {
      id,
      title,
      year: 2024,
      qualityProfileId: 1,
      customFormats: [],
      customFormatScore: 0,
      cfScore: 0,
      missingFormats: [],
      unwantedFormats: [],
      sizeOnDisk: 0,
    };
  }

  it("flattens pages into items", () => {
    const a = makeItem(1, "A");
    const b = makeItem(2, "B");
    const c = makeItem(3, "C");
    const hook = makeQueryHook([
      { items: [a, b], total: 3 },
      { items: [c], total: 3 },
    ]);
    const { result } = renderHook(() =>
      useFlaggedMediaData(hook, 1, baseFilters),
    );
    expect(result.current.items).toEqual([a, b, c]);
  });

  it("reads total from the first page", () => {
    const hook = makeQueryHook([{ items: [makeItem(1, "A")], total: 42 }]);
    const { result } = renderHook(() =>
      useFlaggedMediaData(hook, 1, baseFilters),
    );
    expect(result.current.total).toBe(42);
  });

  it("returns empty items and zero total when data is undefined", () => {
    const hook = makeQueryHook(undefined, { isLoading: true });
    const { result } = renderHook(() =>
      useFlaggedMediaData(hook, 1, baseFilters),
    );
    expect(result.current.items).toEqual([]);
    expect(result.current.total).toBe(0);
  });

  it("forwards query flags", () => {
    const hook = makeQueryHook([], {
      isError: true,
      isFetching: true,
      isFetchingNextPage: true,
      hasNextPage: true,
    });
    const { result } = renderHook(() =>
      useFlaggedMediaData(hook, 1, baseFilters),
    );
    expect(result.current.isError).toBe(true);
    expect(result.current.isFetching).toBe(true);
    expect(result.current.isFetchingNextPage).toBe(true);
    expect(result.current.hasNextPage).toBe(true);
  });

  it("passes instanceId and filters through to the query hook", () => {
    const spy = vi.fn();
    const hook: FlaggedMediaQueryHook<Item> = (...args) => {
      spy(...args);
      return {
        data: undefined,
        isLoading: false,
        isError: false,
        isFetching: false,
        isFetchingNextPage: false,
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        refetch: vi.fn(),
      };
    };
    renderHook(() => useFlaggedMediaData(hook, 7, baseFilters));
    expect(spy).toHaveBeenCalledWith(7, baseFilters);
  });
});
