"use client";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  CfFunnelBody,
  type CfOption,
} from "@/client/components/media/CfColumnFunnel";
import { MonitorFunnelBody } from "@/client/components/media/MonitorColumnFunnel";
import { ProfileFunnelBody } from "@/client/components/media/ProfileColumnFunnel";
import { ScoreFunnelBody } from "@/client/components/media/ScoreColumnFunnel";
import { SeverityFunnelBody } from "@/client/components/media/SeverityColumnFunnel";
import { SizeFunnelBody } from "@/client/components/media/SizeColumnFunnel";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/client/components/ui/sheet";
import type { MediaFilters } from "@/client/hooks/media/useMediaFilters";
import type { QualityProfile } from "@/shared/types/models";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profiles: QualityProfile[] | undefined;
  cfOptions: { penalty: CfOption[] };
  filters: MediaFilters;
  onChange: (patch: Partial<MediaFilters>) => void;
}

interface SectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function FilterSection({ title, description, children }: SectionProps) {
  return (
    <section className="space-y-2 p-4">
      <header className="space-y-0.5">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && (
          <p className="text-muted-foreground text-xs">{description}</p>
        )}
      </header>
      {children}
    </section>
  );
}

// Count of filter axes currently mutating the media result set. Multi-select
// axes count once (not per chip) so "Filters · N" reads as axes, not
// individual chips. Shared by the mobile bar and desktop poster toolbar.
export function countActiveFilters(f: MediaFilters): number {
  let n = 0;
  if (f.profileIds.length > 0) n += 1;
  if (f.severities.length > 0) n += 1;
  if (f.minScore !== null || f.maxScore !== null) n += 1;
  if (f.minSize !== null || f.maxSize !== null) n += 1;
  if (f.hasNegativeCfIds.length > 0) n += 1;
  if (f.monitorStatus !== "all") n += 1;
  return n;
}

export function clearFilterAxes(
  onChange: (patch: Partial<MediaFilters>) => void,
): void {
  onChange({
    profileIds: [],
    severities: [],
    minScore: null,
    maxScore: null,
    minSize: null,
    maxSize: null,
    hasNegativeCfIds: [],
    hasNegativeCfMatch: "all",
    monitorStatus: "all",
  });
}

interface FilterFunnelStackProps {
  profiles: QualityProfile[] | undefined;
  cfOptions: { penalty: CfOption[] };
  filters: MediaFilters;
  onChange: (patch: Partial<MediaFilters>) => void;
}

export function FilterFunnelStack({
  profiles,
  cfOptions,
  filters,
  onChange,
}: FilterFunnelStackProps) {
  const t = useTranslations("filters");
  const tMonitor = useTranslations("filters.monitorStatus");

  return (
    <div className="divide-y">
      <FilterSection
        title={t("severityHeading")}
        description={t("severityColumnDescription")}
      >
        <SeverityFunnelBody filters={filters} onChange={onChange} />
      </FilterSection>
      <FilterSection
        title={tMonitor("label")}
        description={tMonitor("description")}
      >
        <MonitorFunnelBody filters={filters} onChange={onChange} />
      </FilterSection>
      <FilterSection
        title={t("profileHeading")}
        description={t("profileColumnDescription")}
      >
        <ProfileFunnelBody
          profiles={profiles}
          filters={filters}
          onChange={onChange}
        />
      </FilterSection>
      <FilterSection
        title={t("scoreHeading")}
        description={t("scoreColumnDescription")}
      >
        <ScoreFunnelBody filters={filters} onChange={onChange} />
      </FilterSection>
      <FilterSection
        title={t("sizeHeading")}
        description={t("sizeColumnDescription")}
      >
        <SizeFunnelBody filters={filters} onChange={onChange} />
      </FilterSection>
      <FilterSection
        title={t("penaltyHeading")}
        description={t("penaltyColumnDescription")}
      >
        <CfFunnelBody
          options={cfOptions.penalty}
          filters={filters}
          onChange={onChange}
        />
      </FilterSection>
    </div>
  );
}

// Mobile counterpart to the per-column funnel popovers — same chip
// bodies, stacked vertically inside a bottom sheet so every filter
// is reachable without column headers (the table is hidden below md).
// Active-filter state lives entirely in MediaFilters; chip toggles
// commit immediately, mirroring the popover behaviour.
export function FilterSheet({
  open,
  onOpenChange,
  profiles,
  cfOptions,
  filters,
  onChange,
}: Props) {
  const t = useTranslations("filters");
  const anyActive = countActiveFilters(filters) > 0;
  const clearAll = () => clearFilterAxes(onChange);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        // Cap at ~75% of the viewport so the page behind stays partly
        // visible — feels like a sheet, not a takeover.
        className="max-h-[85dvh] gap-0 overflow-y-auto rounded-t-xl p-0"
      >
        <header className="bg-popover sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3">
          <SheetTitle>{t("title")}</SheetTitle>
          <button
            type="button"
            onClick={clearAll}
            disabled={!anyActive}
            className="text-muted-foreground hover:text-foreground text-xs disabled:opacity-40"
          >
            {t("clearAll")}
          </button>
        </header>
        <SheetDescription className="sr-only">
          {t("sheetDescription")}
        </SheetDescription>

        <FilterFunnelStack
          profiles={profiles}
          cfOptions={cfOptions}
          filters={filters}
          onChange={onChange}
        />
      </SheetContent>
    </Sheet>
  );
}
