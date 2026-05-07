"use client";
import { useTranslations } from "next-intl";
import type { MediaFilters } from "@/client/hooks/media/useMediaFilters";
import { isManualMode } from "@/shared/scoring-mode";
import type { ScoringMode } from "@/shared/types/models";
import { ColumnFilter } from "./ColumnFilter";
import { FilterChipButton } from "./FilterChipButton";

interface Bucket {
  id: string;
  // Translation key suffix under "filters.scoreBuckets.*".
  labelKey: string;
  // Half-open semantically: items match when score ≥ min AND score ≤ max.
  // Manual-mode upper bounds are shifted just below the next bucket's
  // floor (e.g. <30% → 0.2999) so the server's inclusive ≤ comparison
  // behaves as half-open without changing applyQuery's contract for
  // every other consumer of maxScore. null = unbounded on that side.
  min: number | null;
  max: number | null;
}

// Manual-mode (cfScore 0..1, fraction of wanted CFs present):
// buckets line up with the four severity bands so the funnel reads the
// same as the severity dot. cfScore = k / N for small integer N, so a
// 0.0001 gap is well below the granularity of any real score.
const MANUAL_BUCKETS: Bucket[] = [
  { id: "lt30", labelKey: "manualLt30", min: null, max: 0.2999 },
  { id: "30to60", labelKey: "manual30to60", min: 0.3, max: 0.5999 },
  { id: "60to85", labelKey: "manual60to85", min: 0.6, max: 0.8499 },
  { id: "gt85", labelKey: "manualGt85", min: 0.85, max: null },
];

// Profile-mode (raw integer score). Items in the table are already below
// their profile cutoff (that's the flagging rule), so the meaningful
// dimension here is sign: penalty CFs (negative) vs neutral vs positive
// but still below cutoff.
const PROFILE_BUCKETS: Bucket[] = [
  { id: "negative", labelKey: "profileNegative", min: null, max: -1 },
  { id: "zero", labelKey: "profileZero", min: 0, max: 0 },
  { id: "positive", labelKey: "profilePositive", min: 1, max: null },
];

interface Props {
  scoringMode: ScoringMode;
  filters: MediaFilters;
  onChange: (patch: Partial<MediaFilters>) => void;
  columnLabel: string;
}

export function ScoreColumnFunnel({
  scoringMode,
  filters,
  onChange,
  columnLabel,
}: Props) {
  const t = useTranslations("filters");
  const tBuckets = useTranslations("filters.scoreBuckets");
  const buckets = isManualMode(scoringMode) ? MANUAL_BUCKETS : PROFILE_BUCKETS;
  const active = filters.minScore !== null || filters.maxScore !== null;
  const matchesBucket = (b: Bucket) =>
    filters.minScore === b.min && filters.maxScore === b.max;
  const select = (b: Bucket) => {
    if (matchesBucket(b)) onChange({ minScore: null, maxScore: null });
    else onChange({ minScore: b.min, maxScore: b.max });
  };

  return (
    <ColumnFilter
      active={active}
      title={t("scoreHeading")}
      description={t("scoreColumnDescription")}
      triggerAriaLabel={t("columnFilterAriaLabel", { column: columnLabel })}
      onClear={
        active ? () => onChange({ minScore: null, maxScore: null }) : undefined
      }
      clearLabel={t("clearFilter")}
    >
      <div className="flex flex-wrap gap-1.5">
        {buckets.map((b) => (
          <FilterChipButton
            key={b.id}
            label={tBuckets(b.labelKey)}
            selected={matchesBucket(b)}
            onClick={() => select(b)}
          />
        ))}
      </div>
    </ColumnFilter>
  );
}
