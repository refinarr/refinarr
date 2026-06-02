// @vitest-environment happy-dom
import type { ReactNode } from "react";
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { QualityProfile } from "@/shared/types/models";
import messages from "../../../../../messages/en.json";
import { useFilterChips } from "../useFilterChips";
import { useMediaFilters, type MediaFiltersResult } from "../useMediaFilters";

function wrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

const profiles: QualityProfile[] = [
  {
    id: 100,
    name: "HD-1080p",
    minUpgradeFormatScore: 0,
    cutoffFormatScore: 100,
    formatItems: [
      { format: 50, name: "x265 Penalty", score: -10000 },
      { format: 51, name: "Bad Group", score: -5000 },
      { format: 52, name: "Good Group", score: 100 },
    ],
  },
];

describe("useFilterChips", () => {
  it("returns no chips when no filters are active", () => {
    const { result } = renderHook(
      () => {
        const filters = useMediaFilters(1);
        return useFilterChips({ filters, profiles });
      },
      { wrapper },
    );
    expect(result.current.chips).toHaveLength(0);
  });

  it("emits a query chip when q is set", () => {
    const { result } = renderHook(
      () => {
        const filters = useMediaFilters(1);
        return { filters, ...useFilterChips({ filters, profiles }) };
      },
      { wrapper },
    );
    act(() =>
      result.current.filters.setFilters((f) => ({ ...f, q: "matrix" })),
    );
    expect(result.current.chips.find((c) => c.key === "q")).toBeTruthy();
  });

  it("emits chips for negative-CF ids derived from quality profiles", () => {
    const { result } = renderHook(
      () => {
        const filters = useMediaFilters(1);
        return { filters, ...useFilterChips({ filters, profiles }) };
      },
      { wrapper },
    );
    act(() =>
      result.current.filters.setFilters((f) => ({
        ...f,
        hasNegativeCfIds: [50],
      })),
    );
    const chip = result.current.chips.find((c) =>
      c.label.includes("x265 Penalty"),
    );
    expect(chip).toBeTruthy();
  });

  it("clearActiveFilters resets value-bearing filters but keeps sort + match modes", () => {
    let captured!: MediaFiltersResult["filters"];
    const { result } = renderHook(
      () => {
        const filters = useMediaFilters(1);
        captured = filters.filters;
        return { filters, ...useFilterChips({ filters, profiles }) };
      },
      { wrapper },
    );
    act(() =>
      result.current.filters.setFilters((f) => ({
        ...f,
        q: "x",
        profileIds: [100],
        severities: ["critical"],
        hasNegativeCfIds: [50],
        minScore: 0,
        maxScore: 0.5,
        minSize: 0,
        maxSize: 1_000_000_000,
        sortBy: "title",
        order: "desc",
        hasNegativeCfMatch: "any",
      })),
    );
    act(() => result.current.clearActiveFilters());
    captured = result.current.filters.filters;
    expect(captured.q).toBe("");
    expect(captured.profileIds).toEqual([]);
    expect(captured.severities).toEqual([]);
    expect(captured.hasNegativeCfIds).toEqual([]);
    expect(captured.minScore).toBeNull();
    expect(captured.maxScore).toBeNull();
    expect(captured.minSize).toBeNull();
    expect(captured.maxSize).toBeNull();
    // Preferences preserved
    expect(captured.sortBy).toBe("title");
    expect(captured.order).toBe("desc");
    expect(captured.hasNegativeCfMatch).toBe("any");
  });
});
