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

function Section({ title, description, children }: SectionProps) {
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
  const tMonitor = useTranslations("filters.monitorStatus");
  const cfFunnelOptions = cfOptions.penalty;
  const cfTitle = t("penaltyHeading");
  const cfDescription = t("penaltyColumnDescription");

  const anyActive =
    filters.profileIds.length > 0 ||
    filters.severities.length > 0 ||
    filters.minScore !== null ||
    filters.maxScore !== null ||
    filters.minSize !== null ||
    filters.maxSize !== null ||
    filters.hasNegativeCfIds.length > 0 ||
    filters.monitorStatus !== "all";

  const clearAll = () =>
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

        <div className="divide-y">
          <Section
            title={t("severityHeading")}
            description={t("severityColumnDescription")}
          >
            <SeverityFunnelBody filters={filters} onChange={onChange} />
          </Section>
          <Section
            title={tMonitor("label")}
            description={tMonitor("description")}
          >
            <MonitorFunnelBody filters={filters} onChange={onChange} />
          </Section>
          <Section
            title={t("profileHeading")}
            description={t("profileColumnDescription")}
          >
            <ProfileFunnelBody
              profiles={profiles}
              filters={filters}
              onChange={onChange}
            />
          </Section>
          <Section
            title={t("scoreHeading")}
            description={t("scoreColumnDescription")}
          >
            <ScoreFunnelBody filters={filters} onChange={onChange} />
          </Section>
          <Section
            title={t("sizeHeading")}
            description={t("sizeColumnDescription")}
          >
            <SizeFunnelBody filters={filters} onChange={onChange} />
          </Section>
          <Section title={cfTitle} description={cfDescription}>
            <CfFunnelBody
              options={cfFunnelOptions}
              filters={filters}
              onChange={onChange}
            />
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
