// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMediaFilters, defaultMediaFilters } from "../useMediaFilters";

describe("useMediaFilters", () => {
  it("starts with the default filter set", () => {
    const { result } = renderHook(() => useMediaFilters("manual", 1));
    expect(result.current.filters).toEqual(defaultMediaFilters);
  });

  it("merges scoringMode into forQuery", () => {
    const { result } = renderHook(() => useMediaFilters("profile", 1));
    expect(result.current.forQuery.scoringMode).toBe("profile");
  });

  it("resets mode-specific filters when scoringMode toggles", () => {
    const { result, rerender } = renderHook(
      ({ mode }: { mode: "manual" | "profile" }) => useMediaFilters(mode, 1),
      { initialProps: { mode: "manual" } },
    );
    act(() => {
      result.current.setFilters((f) => ({
        ...f,
        missingCfIds: [10, 11],
        missingCfMatch: "any",
        hasNegativeCfIds: [20],
        hasNegativeCfMatch: "any",
        minScore: 0,
        maxScore: 0.5,
      }));
    });
    expect(result.current.filters.missingCfIds).toEqual([10, 11]);
    expect(result.current.filters.missingCfMatch).toBe("any");
    expect(result.current.filters.maxScore).toBe(0.5);

    rerender({ mode: "profile" });
    expect(result.current.filters.missingCfIds).toEqual([]);
    expect(result.current.filters.hasNegativeCfIds).toEqual([]);
    expect(result.current.filters.missingCfMatch).toBe("all");
    expect(result.current.filters.hasNegativeCfMatch).toBe("all");
    expect(result.current.filters.minScore).toBeNull();
    expect(result.current.filters.maxScore).toBeNull();
  });

  it("preserves non-mode-specific filter fields across mode changes", () => {
    const { result, rerender } = renderHook(
      ({ mode }: { mode: "manual" | "profile" }) => useMediaFilters(mode, 1),
      { initialProps: { mode: "manual" } },
    );
    act(() => {
      result.current.setFilters((f) => ({ ...f, q: "alpha", profileIds: [5] }));
    });
    rerender({ mode: "profile" });
    expect(result.current.filters.q).toBe("alpha");
    // profileIds are per-instance, not mode-scoped — they survive a mode flip.
    expect(result.current.filters.profileIds).toEqual([5]);
  });

  it("resets per-instance filters (profileIds + CF ids + match modes) when instanceId changes", () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: number }) => useMediaFilters("profile", id),
      { initialProps: { id: 1 } },
    );
    act(() => {
      result.current.setFilters((f) => ({
        ...f,
        profileIds: [7, 8],
        missingCfIds: [10],
        missingCfMatch: "any",
        hasNegativeCfIds: [20, 21],
        hasNegativeCfMatch: "any",
        q: "stay",
      }));
    });
    expect(result.current.filters.profileIds).toEqual([7, 8]);

    rerender({ id: 2 });
    expect(result.current.filters.profileIds).toEqual([]);
    expect(result.current.filters.missingCfIds).toEqual([]);
    expect(result.current.filters.hasNegativeCfIds).toEqual([]);
    expect(result.current.filters.missingCfMatch).toBe("all");
    expect(result.current.filters.hasNegativeCfMatch).toBe("all");
    // Cross-instance fields like the search query persist.
    expect(result.current.filters.q).toBe("stay");
  });
});
