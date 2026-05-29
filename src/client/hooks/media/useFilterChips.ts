"use client";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { type FilterChip } from "@/client/components/common/ActiveFilterChips";
import { severityLabel } from "@/client/lib/severity";
import { formatBytes } from "@/client/lib/format";
import type {
  CfPreference,
  QualityProfile,
  Severity,
} from "@/shared/types/models";
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
  // Resets every value-bearing filter. Preserves sort order and match-mode
  // preferences.
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

  const profileNameOf = (id: number) =>
    profiles?.find((p) => p.id === id)?.name;

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
  const removeProfile = (id: number) =>
    filters.setFilters((f) => ({
      ...f,
      profileIds: f.profileIds.filter((x) => x !== id),
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

  const profileChips: FilterChip[] = filters.filters.profileIds
    .map((id): FilterChip | null => {
      const name = profileNameOf(id);
      return name
        ? {
            key: `profile-${id}`,
            label: t("profileLabel", { name }),
            onRemove: () => removeProfile(id),
          }
        : null;
    })
    .filter((c): c is FilterChip => c !== null);

  const removeSeverity = (sev: Severity) =>
    filters.setFilters((f) => ({
      ...f,
      severities: f.severities.filter((x) => x !== sev),
    }));
  const severityChips: FilterChip[] = filters.filters.severities.map((sev) => ({
    key: `sev-${sev}`,
    label: t("severityLabel", { name: severityLabel[sev] }),
    onRemove: () => removeSeverity(sev),
  }));

  const { minScore, maxScore, minSize, maxSize } = filters.filters;
  // Contextual range labels — when only one bound is set, the chip reads
  // as "X or above" / "up to X" instead of "−∞ – X" / "X – +∞" math
  // notation. Both bounds set → "min to max".
  const scoreChipLabel = () => {
    if (minScore !== null && maxScore !== null) {
      return t("scoreRangeBoth", {
        min: String(minScore),
        max: String(maxScore),
      });
    }
    if (minScore !== null) return t("scoreRangeMin", { min: String(minScore) });
    return t("scoreRangeMax", { max: String(maxScore) });
  };
  const scoreChip: FilterChip | null =
    minScore !== null || maxScore !== null
      ? {
          key: "score",
          label: scoreChipLabel(),
          onRemove: () =>
            filters.setFilters((f) => ({
              ...f,
              minScore: null,
              maxScore: null,
            })),
        }
      : null;
  const sizeChipLabel = () => {
    if (minSize !== null && maxSize !== null) {
      return t("sizeRangeBoth", {
        min: formatBytes(minSize),
        max: formatBytes(maxSize),
      });
    }
    if (minSize !== null) {
      return t("sizeRangeMin", { min: formatBytes(minSize) });
    }
    return t("sizeRangeMax", { max: formatBytes(maxSize as number) });
  };
  const sizeChip: FilterChip | null =
    minSize !== null || maxSize !== null
      ? {
          key: "size",
          label: sizeChipLabel(),
          onRemove: () =>
            filters.setFilters((f) => ({
              ...f,
              minSize: null,
              maxSize: null,
            })),
        }
      : null;

  const tStatus = useTranslations("filters.monitorStatus");
  const monitorStatusChip: FilterChip | null =
    filters.filters.monitorStatus !== "all"
      ? {
          key: "monitorStatus",
          label: t("monitorStatusLabel", {
            value: tStatus(filters.filters.monitorStatus),
          }),
          onRemove: () =>
            filters.setFilters((f) => ({ ...f, monitorStatus: "all" })),
        }
      : null;

  const chips: FilterChip[] = [
    filters.filters.mediaId !== null && {
      key: "mediaId",
      label: t("mediaIdLabel"),
      onRemove: () => filters.setFilters((f) => ({ ...f, mediaId: null })),
    },
    filters.filters.q && {
      key: "q",
      label: t("queryLabel", { q: filters.filters.q }),
      onRemove: () => filters.setFilters((f) => ({ ...f, q: "" })),
    },
    ...profileChips,
    ...severityChips,
    scoreChip,
    sizeChip,
    monitorStatusChip,
    ...missingChips,
    ...penaltyChips,
  ].filter(Boolean) as FilterChip[];

  const clearActiveFilters = () =>
    filters.setFilters((f) => ({
      ...f,
      q: "",
      mediaId: null,
      profileIds: [],
      severities: [],
      minScore: null,
      maxScore: null,
      minSize: null,
      maxSize: null,
      missingCfIds: [],
      hasNegativeCfIds: [],
      monitorStatus: "all",
    }));

  return { chips, clearActiveFilters };
}
