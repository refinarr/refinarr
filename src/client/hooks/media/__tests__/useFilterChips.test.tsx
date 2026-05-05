// @vitest-environment happy-dom
import type { ReactNode } from "react";
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../messages/en.json";
import type { CfPreference, QualityProfile } from "@/shared/types/models";
import { useFilterChips } from "../useFilterChips";
import { useMediaFilters, type MediaFiltersResult } from "../useMediaFilters";

function wrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

const prefs: CfPreference[] = [
  { id: 1, instanceId: 1, cfId: 10, cfName: "HDR10+" },
  { id: 2, instanceId: 1, cfId: 11, cfName: "Atmos" },
];

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
        const filters = useMediaFilters("manual", 1);
        return useFilterChips({ filters, prefs, profiles });
      },
      { wrapper },
    );
    expect(result.current.chips).toHaveLength(0);
  });

  it("emits a query chip when q is set", () => {
    const { result } = renderHook(
      () => {
        const filters = useMediaFilters("manual", 1);
        return { filters, ...useFilterChips({ filters, prefs, profiles }) };
      },
      { wrapper },
    );
    act(() => result.current.filters.setFilters((f) => ({ ...f, q: "matrix" })));
    expect(result.current.chips.find((c) => c.key === "q")).toBeTruthy();
  });

  it("emits chips for missing CF ids using preference names", () => {
    const { result } = renderHook(
      () => {
        const filters = useMediaFilters("manual", 1);
        return { filters, ...useFilterChips({ filters, prefs, profiles }) };
      },
      { wrapper },
    );
    act(() => result.current.filters.setFilters((f) => ({ ...f, missingCfIds: [10] })));
    const chip = result.current.chips.find((c) => c.label.includes("HDR10+"));
    expect(chip).toBeTruthy();
  });

  it("emits chips for negative-CF ids derived from quality profiles", () => {
    const { result } = renderHook(
      () => {
        const filters = useMediaFilters("profile", 1);
        return { filters, ...useFilterChips({ filters, prefs, profiles }) };
      },
      { wrapper },
    );
    act(() =>
      result.current.filters.setFilters((f) => ({ ...f, hasNegativeCfIds: [50] })),
    );
    const chip = result.current.chips.find((c) => c.label.includes("x265 Penalty"));
    expect(chip).toBeTruthy();
  });

  it("emits an onlyMissing chip when toggled on", () => {
    const { result } = renderHook(
      () => {
        const filters = useMediaFilters("manual", 1);
        return { filters, ...useFilterChips({ filters, prefs, profiles }) };
      },
      { wrapper },
    );
    act(() => result.current.filters.setFilters((f) => ({ ...f, onlyMissing: true })));
    expect(result.current.chips.some((c) => c.key === "onlyMissing")).toBe(true);
  });

  it("clearActiveFilters resets value-bearing filters but keeps sort + match modes", () => {
    let captured!: MediaFiltersResult["filters"];
    const { result } = renderHook(
      () => {
        const filters = useMediaFilters("manual", 1);
        captured = filters.filters;
        return { filters, ...useFilterChips({ filters, prefs, profiles }) };
      },
      { wrapper },
    );
    act(() =>
      result.current.filters.setFilters((f) => ({
        ...f,
        q: "x",
        profileId: 100,
        missingCfIds: [10],
        hasNegativeCfIds: [50],
        maxScore: 0.5,
        onlyMissing: true,
        sortBy: "title",
        order: "desc",
        missingCfMatch: "any",
      })),
    );
    act(() => result.current.clearActiveFilters());
    captured = result.current.filters.filters;
    expect(captured.q).toBe("");
    expect(captured.profileId).toBe(null);
    expect(captured.missingCfIds).toEqual([]);
    expect(captured.hasNegativeCfIds).toEqual([]);
    expect(captured.maxScore).toBe(1);
    expect(captured.onlyMissing).toBe(false);
    // Preferences preserved
    expect(captured.sortBy).toBe("title");
    expect(captured.order).toBe("desc");
    expect(captured.missingCfMatch).toBe("any");
  });
});
