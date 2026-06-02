"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { SlidersHorizontal } from "lucide-react";
import type { MediaFilters } from "@/client/hooks/media/useMediaFilters";
import { usePrefersReducedMotion } from "@/client/hooks/ui/useMediaQuery";
import { useScrollDirection } from "@/client/hooks/ui/useScrollDirection";
import { cn } from "@/client/lib/utils";
import type { QualityProfile } from "@/shared/types/models";
import { FilterSheet } from "./FilterSheet";
import type { CfOption } from "./CfColumnFunnel";

interface Props {
  profiles: QualityProfile[] | undefined;
  cfOptions: { penalty: CfOption[] };
  filters: MediaFilters;
  onChange: (patch: Partial<MediaFilters>) => void;
}

// Count of filter axes currently mutating the table. Mirrors the chips
// strip's notion of "active filters" — multi-select axes count once
// (not per chip) so "Filters · N" reads as axes, not individual chips.
function countActiveFilters(f: MediaFilters): number {
  let n = 0;
  if (f.profileIds.length > 0) n += 1;
  if (f.severities.length > 0) n += 1;
  if (f.minScore !== null || f.maxScore !== null) n += 1;
  if (f.minSize !== null || f.maxSize !== null) n += 1;
  if (f.hasNegativeCfIds.length > 0) n += 1;
  if (f.monitorStatus !== "all") n += 1;
  return n;
}

// Mobile-only fixed-bottom toolbar. Sits above the AppShell's
// MobileTabBar (--spacing-bottom-bar). One trigger — "Filters" — opens
// the FilterSheet; the previous "Only missing" pill duplicated the
// severity-funnel "No file" bucket, so it lives in the sheet now.
export function MobileFilterBar({
  profiles,
  cfOptions,
  filters,
  onChange,
}: Props) {
  const t = useTranslations("filters");
  const [sheetOpen, setSheetOpen] = useState(false);
  const activeCount = countActiveFilters(filters);

  // Auto-hide on scroll-down to free screen real estate; re-show on
  // scroll-up. Sheet-open state suppresses the hide so the trigger
  // can't slip away mid-tap. Mirrors MobileTabBar's behaviour so both
  // bars move in lockstep.
  const direction = useScrollDirection();
  const prefersReducedMotion = usePrefersReducedMotion();
  const hidden = direction === "down" && !sheetOpen;

  return (
    <>
      <div
        role="toolbar"
        aria-label={t("toolbarAriaLabel")}
        className={cn(
          "bg-card/90 border-border/60 h-mobile-filter-bar fixed inset-x-0 bottom-[calc(var(--spacing-bottom-bar)+env(safe-area-inset-bottom))] z-30 flex items-center gap-2 border-t px-3 backdrop-blur-md md:hidden",
          // translate-y-full slides the bar past its own height + the
          // tab bar beneath it. prefers-reduced-motion replaces the
          // slide with an instant toggle so motion-sensitive users
          // still get the layout affordance without the animation.
          prefersReducedMotion ? "" : "transition-transform duration-200",
          hidden && "translate-y-[calc(100%+var(--spacing-bottom-bar))]",
          // Selection mode: when the floating BulkActionToolbar is open
          // (`<html data-bulk-bar="open">`), slide this bar out too —
          // it sits above the now-hidden tab bar, so leaving it visible
          // strands a "Filters" pill in mid-air above the floating
          // pill. Matches the MobileTabBar treatment so the entire
          // bottom UI gives way to the selection bar.
          "[html[data-bulk-bar=open]_&]:pointer-events-none [html[data-bulk-bar=open]_&]:translate-y-[calc(100%+var(--spacing-bottom-bar)+env(safe-area-inset-bottom))]",
        )}
      >
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          className={cn(
            "h-control-sm ml-auto inline-flex items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors pointer-coarse:min-h-11",
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
        profiles={profiles}
        cfOptions={cfOptions}
        filters={filters}
        onChange={onChange}
      />
    </>
  );
}
