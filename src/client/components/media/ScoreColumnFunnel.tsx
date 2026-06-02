"use client";
import { useTranslations } from "next-intl";
import type { MediaFilters } from "@/client/hooks/media/useMediaFilters";
import { ColumnFilter } from "./ColumnFilter";
import { FilterChipButton } from "./FilterChipButton";

interface Bucket {
  id: string;
  // Translation key suffix under "filters.scoreBuckets.*".
  labelKey: "profileNegative" | "profileZero" | "profilePositive";
  // Half-open semantically: items match when score ≥ min AND score ≤ max.
  // null = unbounded on that side.
  min: number | null;
  max: number | null;
}

// Raw integer score. Items in the table are already below their profile
// cutoff (that's the flagging rule), so the meaningful dimension here is
// sign: penalty CFs (negative) vs neutral vs positive but still below cutoff.
const PROFILE_BUCKETS: Bucket[] = [
  { id: "negative", labelKey: "profileNegative", min: null, max: -1 },
  { id: "zero", labelKey: "profileZero", min: 0, max: 0 },
  { id: "positive", labelKey: "profilePositive", min: 1, max: null },
];

interface BodyProps {
  filters: MediaFilters;
  onChange: (patch: Partial<MediaFilters>) => void;
}

export function ScoreFunnelBody({ filters, onChange }: BodyProps) {
  const tBuckets = useTranslations("filters.scoreBuckets");
  const buckets = PROFILE_BUCKETS;
  const matchesBucket = (b: Bucket) =>
    filters.minScore === b.min && filters.maxScore === b.max;
  const select = (b: Bucket) => {
    if (matchesBucket(b)) onChange({ minScore: null, maxScore: null });
    else onChange({ minScore: b.min, maxScore: b.max });
  };
  return (
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
  );
}

interface Props extends BodyProps {
  columnLabel: string;
}

export function ScoreColumnFunnel({ filters, onChange, columnLabel }: Props) {
  const t = useTranslations("filters");
  const active = filters.minScore !== null || filters.maxScore !== null;
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
      <ScoreFunnelBody filters={filters} onChange={onChange} />
    </ColumnFilter>
  );
}
