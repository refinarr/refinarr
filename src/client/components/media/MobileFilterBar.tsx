"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { SlidersHorizontal, Check } from "lucide-react";
import type { MediaFilters } from "@/client/hooks/media/useMediaFilters";
import { cn } from "@/client/lib/utils";
import type { QualityProfile, ScoringMode } from "@/shared/types/models";
import { FilterSheet } from "./FilterSheet";
import type { CfOption } from "./CfColumnFunnel";

interface Props {
  scoringMode: ScoringMode;
  profiles: QualityProfile[] | undefined;
  cfOptions: { missing: CfOption[]; penalty: CfOption[] };
  filters: MediaFilters;
  onChange: (patch: Partial<MediaFilters>) => void;
}

// Counts the sheet-managed filter axes only — onlyMissing has its own
// always-visible toggle in this bar, so including it would inflate the
// Filters badge while the sheet itself can't see/clear it. Multi-select
// axes count once (not per chip) so "Filters · N" reads as the number
// of axes that mutate the table, not the number of selected chips.
function countActiveFilters(f: MediaFilters): number {
  let n = 0;
  if (f.profileIds.length > 0) n += 1;
  if (f.severities.length > 0) n += 1;
  if (f.minScore !== null || f.maxScore !== null) n += 1;
  if (f.minSize !== null || f.maxSize !== null) n += 1;
  if (f.missingCfIds.length > 0) n += 1;
  if (f.hasNegativeCfIds.length > 0) n += 1;
  return n;
}

// Mobile-only fixed-bottom toolbar. Sits above the AppShell's
// MobileTabBar (--spacing-bottom-bar) and below any visible
// BulkActionToolbar — both other layers honour
// --spacing-mobile-filter-bar in their bottom offsets so nothing
// overlaps. Exposes one big "Filters" button (with active-axis badge)
// plus the always-on "Only missing" toggle so the most common filter
// action stays one tap away.
export function MobileFilterBar({
  scoringMode,
  profiles,
  cfOptions,
  filters,
  onChange,
}: Props) {
  const t = useTranslations("filters");
  const [sheetOpen, setSheetOpen] = useState(false);
  const activeCount = countActiveFilters(filters);
  const onlyMissingActive = filters.onlyMissing;

  return (
    <>
      <div
        role="toolbar"
        aria-label={t("toolbarAriaLabel")}
        className="bg-card/90 border-border/60 h-mobile-filter-bar fixed inset-x-0 bottom-[calc(var(--spacing-bottom-bar)+env(safe-area-inset-bottom))] z-30 flex items-center gap-2 border-t px-3 backdrop-blur-md md:hidden"
      >
        <button
          type="button"
          aria-pressed={onlyMissingActive}
          onClick={() => onChange({ onlyMissing: !filters.onlyMissing })}
          className={cn(
            "h-control-sm inline-flex items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
            onlyMissingActive
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          {onlyMissingActive && <Check className="size-3" />}
          {t("onlyMissing")}
        </button>

        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          className={cn(
            "h-control-sm ml-auto inline-flex items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
            activeCount > 0
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          <SlidersHorizontal className="size-3.5" />
          {t("openFilters")}
          {activeCount > 0 && (
            <span
              aria-label={t("activeCountAriaLabel", { count: activeCount })}
              className="bg-primary-foreground/20 text-primary-foreground inline-flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums"
            >
              {activeCount}
            </span>
          )}
        </button>
      </div>

      <FilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        scoringMode={scoringMode}
        profiles={profiles}
        cfOptions={cfOptions}
        filters={filters}
        onChange={onChange}
      />
    </>
  );
}
