"use client";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { type FilterChip } from "@/client/components/common/ActiveFilterChips";
import type { CfPreference, QualityProfile } from "@/shared/types/models";
import type { MediaFiltersResult } from "./useMediaFilters";

// CF chip-building helper — used only by useFilterChips, so it lives here
// rather than alongside the generic ActiveFilterChips component.
function buildCfChips(args: {
  ids: number[];
  options: { id: number; name: string }[];
  label: (name: string) => string;
  removeId: (id: number) => void;
  keyPrefix: string;
}): FilterChip[] {
  return args.ids
    .map((id): FilterChip | null => {
      const name = args.options.find((c) => c.id === id)?.name;
      return name
        ? {
            key: `${args.keyPrefix}-${id}`,
            label: args.label(name),
            onRemove: () => args.removeId(id),
          }
        : null;
    })
    .filter((c): c is FilterChip => c !== null);
}

interface Args {
  filters: MediaFiltersResult;
  prefs: CfPreference[] | undefined;
  profiles: QualityProfile[] | undefined;
}

export interface FilterChipsResult {
  chips: FilterChip[];
  // Resets every value-bearing filter (q, profileId, CF lists, maxScore,
  // onlyMissing). Preserves sort order and match-mode preferences.
  clearActiveFilters: () => void;
}

export function useFilterChips({
  filters,
  prefs,
  profiles,
}: Args): FilterChipsResult {
  const t = useTranslations("filters");

  const wantedCfOptions = useMemo(
    () => (prefs ?? []).map((p) => ({ id: p.cfId, name: p.cfName })),
    [prefs],
  );

  const negativeCfOptions = useMemo(() => {
    const pairs = (profiles ?? [])
      .flatMap((p) => p.formatItems ?? [])
      .filter((item) => item.score < 0)
      .map((item) => [item.format, item.name] as const);
    return Array.from(new Map(pairs), ([id, name]) => ({ id, name }));
  }, [profiles]);

  const profileName = profiles?.find(
    (p) => p.id === filters.filters.profileId,
  )?.name;

  const removeMissingCf = (id: number) =>
    filters.setFilters((f) => ({
      ...f,
      missingCfIds: f.missingCfIds.filter((x) => x !== id),
    }));
  const removePenaltyCf = (id: number) =>
    filters.setFilters((f) => ({
      ...f,
      hasNegativeCfIds: f.hasNegativeCfIds.filter((x) => x !== id),
    }));

  const missingChips = buildCfChips({
    ids: filters.filters.missingCfIds,
    options: wantedCfOptions,
    label: (name) => t("missingLabel", { name }),
    removeId: removeMissingCf,
    keyPrefix: "cf",
  });
  const penaltyChips = buildCfChips({
    ids: filters.filters.hasNegativeCfIds,
    options: negativeCfOptions,
    label: (name) => t("penaltyLabel", { name }),
    removeId: removePenaltyCf,
    keyPrefix: "ncf",
  });

  const chips: FilterChip[] = [
    filters.filters.q && {
      key: "q",
      label: t("queryLabel", { q: filters.filters.q }),
      onRemove: () => filters.setFilters((f) => ({ ...f, q: "" })),
    },
    filters.filters.profileId !== null &&
      profileName && {
        key: "profile",
        label: t("profileLabel", { name: profileName }),
        onRemove: () => filters.setFilters((f) => ({ ...f, profileId: null })),
      },
    ...missingChips,
    ...penaltyChips,
    filters.filters.onlyMissing && {
      key: "onlyMissing",
      label: t("onlyMissing"),
      onRemove: () => filters.setFilters((f) => ({ ...f, onlyMissing: false })),
    },
  ].filter(Boolean) as FilterChip[];

  const clearActiveFilters = () =>
    filters.setFilters((f) => ({
      ...f,
      q: "",
      profileId: null,
      missingCfIds: [],
      hasNegativeCfIds: [],
      maxScore: 1,
      onlyMissing: false,
    }));

  return { chips, clearActiveFilters };
}
