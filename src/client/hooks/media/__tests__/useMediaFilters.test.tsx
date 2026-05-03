// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMediaFilters, defaultMediaFilters } from "../useMediaFilters";

describe("useMediaFilters", () => {
  it("starts with the default filter set", () => {
    const { result } = renderHook(() => useMediaFilters("manual"));
    expect(result.current.filters).toEqual(defaultMediaFilters);
  });

  it("merges scoringMode into forQuery", () => {
    const { result } = renderHook(() => useMediaFilters("profile"));
    expect(result.current.forQuery.scoringMode).toBe("profile");
  });

  it("resets mode-specific filters when scoringMode toggles", () => {
    const { result, rerender } = renderHook(
      ({ mode }: { mode: "manual" | "profile" }) => useMediaFilters(mode),
      { initialProps: { mode: "manual" } },
    );
    act(() => {
      result.current.setFilters((f) => ({
        ...f,
        missingCfId: 10,
        hasNegativeCfId: 20,
        maxScore: 0.5,
      }));
    });
    expect(result.current.filters.missingCfId).toBe(10);
    expect(result.current.filters.maxScore).toBe(0.5);

    rerender({ mode: "profile" });
    expect(result.current.filters.missingCfId).toBeNull();
    expect(result.current.filters.hasNegativeCfId).toBeNull();
    expect(result.current.filters.maxScore).toBe(1);
  });

  it("preserves non-mode-specific filter fields across mode changes", () => {
    const { result, rerender } = renderHook(
      ({ mode }: { mode: "manual" | "profile" }) => useMediaFilters(mode),
      { initialProps: { mode: "manual" } },
    );
    act(() => {
      result.current.setFilters((f) => ({ ...f, q: "alpha", profileId: 5 }));
    });
    rerender({ mode: "profile" });
    expect(result.current.filters.q).toBe("alpha");
    expect(result.current.filters.profileId).toBe(5);
  });
});
