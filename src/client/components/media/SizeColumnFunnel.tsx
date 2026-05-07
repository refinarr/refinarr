"use client";
import { useTranslations } from "next-intl";
import type { MediaFilters } from "@/client/hooks/media/useMediaFilters";
import { ColumnFilter } from "./ColumnFilter";
import { FilterChipButton } from "./FilterChipButton";

const GB = 1024 ** 3;

interface Bucket {
  id: string;
  // Translation key suffix under "filters.sizeBuckets.*". Each suffix
  // owns the displayed label so locales can localize unit/range text.
  labelKey: "lt1" | "to1to5" | "to5to10" | "to10to25" | "to25to50" | "gt50";
  min: number | null;
  // Inclusive upper bound — exclusive at the next bucket's lower bound
  // (e.g. "1–5 GB" stops at 5 GB − 1 byte) so a single 5 GB file falls
  // into the higher bucket only.
  max: number | null;
}

const BUCKETS: Bucket[] = [
  { id: "lt1", labelKey: "lt1", min: null, max: 1 * GB - 1 },
  { id: "1to5", labelKey: "to1to5", min: 1 * GB, max: 5 * GB - 1 },
  { id: "5to10", labelKey: "to5to10", min: 5 * GB, max: 10 * GB - 1 },
  { id: "10to25", labelKey: "to10to25", min: 10 * GB, max: 25 * GB - 1 },
  { id: "25to50", labelKey: "to25to50", min: 25 * GB, max: 50 * GB - 1 },
  { id: "gt50", labelKey: "gt50", min: 50 * GB, max: null },
];

interface Props {
  filters: MediaFilters;
  onChange: (patch: Partial<MediaFilters>) => void;
  columnLabel: string;
}

// Single-select bucket chips for the "size" column. Each chip maps to a
// fixed [minSize, maxSize] tuple — clicking an active chip clears the
// filter. Buckets that don't match the current filter (e.g. a manually
// dialled-in range from a future iteration) leave no chip active but
// keep the Clear affordance available.
export function SizeColumnFunnel({ filters, onChange, columnLabel }: Props) {
  const t = useTranslations("filters");
  const tBuckets = useTranslations("filters.sizeBuckets");
  const active = filters.minSize !== null || filters.maxSize !== null;
  const matchesBucket = (b: Bucket) =>
    filters.minSize === b.min && filters.maxSize === b.max;

  const select = (b: Bucket) => {
    if (matchesBucket(b)) onChange({ minSize: null, maxSize: null });
    else onChange({ minSize: b.min, maxSize: b.max });
  };

  return (
    <ColumnFilter
      active={active}
      title={t("sizeHeading")}
      description={t("sizeColumnDescription")}
      triggerAriaLabel={t("columnFilterAriaLabel", { column: columnLabel })}
      onClear={
        active ? () => onChange({ minSize: null, maxSize: null }) : undefined
      }
      clearLabel={t("clearFilter")}
    >
      <div className="flex flex-wrap gap-1.5">
        {BUCKETS.map((b) => (
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
