// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMediaFilters, defaultMediaFilters } from "../useMediaFilters";

describe("useMediaFilters", () => {
  it("starts with the default filter set", () => {
    const { result } = renderHook(() => useMediaFilters(1));
    expect(result.current.filters).toEqual(defaultMediaFilters);
  });

  it("preserves non-instance-specific filter fields across instance changes", () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: number }) => useMediaFilters(id),
      { initialProps: { id: 1 } },
    );
    act(() => {
      result.current.setFilters((f) => ({ ...f, q: "alpha", profileIds: [5] }));
    });
    rerender({ id: 2 });
    expect(result.current.filters.q).toBe("alpha");
    // profileIds are per-instance — they reset on an instance flip.
    expect(result.current.filters.profileIds).toEqual([]);
  });

  it("resets per-instance filters using the next instance show-all setting when instanceId changes", () => {
    const { result, rerender } = renderHook(
      ({ id, showAllMedia }: { id: number; showAllMedia: boolean }) =>
        useMediaFilters(id, showAllMedia),
      { initialProps: { id: 1, showAllMedia: false } },
    );
    act(() => {
      result.current.setFilters((f) => ({
        ...f,
        profileIds: [7, 8],
        hasNegativeCfIds: [20, 21],
        hasNegativeCfMatch: "any",
        flaggedOnly: false,
        q: "stay",
      }));
    });
    expect(result.current.filters.profileIds).toEqual([7, 8]);

    rerender({ id: 2, showAllMedia: true });
    expect(result.current.filters.profileIds).toEqual([]);
    expect(result.current.filters.hasNegativeCfIds).toEqual([]);
    expect(result.current.filters.hasNegativeCfMatch).toBe("all");
    expect(result.current.filters.flaggedOnly).toBe(false);
    // Cross-instance fields like the search query persist.
    expect(result.current.filters.q).toBe("stay");
  });

  it("updates flaggedOnly without clearing filters when the active instance show-all setting changes", () => {
    const { result, rerender } = renderHook(
      ({ showAllMedia }: { showAllMedia: boolean }) =>
        useMediaFilters(1, showAllMedia),
      { initialProps: { showAllMedia: false } },
    );
    act(() => {
      result.current.setFilters((f) => ({
        ...f,
        profileIds: [7],
        hasNegativeCfIds: [20],
        hasNegativeCfMatch: "any",
      }));
    });
    expect(result.current.filters.flaggedOnly).toBe(true);

    rerender({ showAllMedia: true });
    expect(result.current.filters.flaggedOnly).toBe(false);
    expect(result.current.filters.profileIds).toEqual([7]);
    expect(result.current.filters.hasNegativeCfIds).toEqual([20]);
    expect(result.current.filters.hasNegativeCfMatch).toBe("any");
  });
});
