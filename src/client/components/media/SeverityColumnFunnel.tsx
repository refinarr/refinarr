"use client";
import { useTranslations } from "next-intl";
import type { MediaFilters } from "@/client/hooks/media/useMediaFilters";
import { severityLabel } from "@/client/lib/severity";
import type { Severity } from "@/shared/types/models";
import { ColumnFilter } from "./ColumnFilter";
import { FilterChipButton } from "./FilterChipButton";

const ORDER: Severity[] = ["critical", "low", "warning", "ok", "missing"];

// Per-bucket selected-state surfaces — dot colors that match the
// SeverityDot in the table. Keeps the chip palette aligned with the
// column's visual language so users connect chip → dot at a glance.
const SELECTED_CLASS: Record<Severity, string> = {
  critical: "border-critical bg-critical text-critical-foreground",
  low: "border-warning bg-warning text-warning-foreground",
  warning: "border-warning bg-warning text-warning-foreground",
  ok: "border-ok bg-ok text-ok-foreground",
  missing: "border-neutral-soft bg-neutral-soft text-foreground",
};

interface BodyProps {
  filters: MediaFilters;
  onChange: (patch: Partial<MediaFilters>) => void;
}

// Chip wrap used by both the column funnel popover and the mobile
// FilterSheet. Single source of truth for the severity chip rendering.
export function SeverityFunnelBody({ filters, onChange }: BodyProps) {
  const selected = filters.severities;
  const toggle = (sev: Severity) =>
    onChange({
      severities: selected.includes(sev)
        ? selected.filter((x) => x !== sev)
        : [...selected, sev],
    });
  return (
    <div className="flex flex-wrap gap-1.5">
      {ORDER.map((sev) => (
        <FilterChipButton
          key={sev}
          label={severityLabel[sev]}
          selected={selected.includes(sev)}
          onClick={() => toggle(sev)}
          selectedClassName={SELECTED_CLASS[sev]}
        />
      ))}
    </div>
  );
}

interface Props extends BodyProps {
  columnLabel: string;
}

export function SeverityColumnFunnel({
  filters,
  onChange,
  columnLabel,
}: Props) {
  const t = useTranslations("filters");
  const active = filters.severities.length > 0;
  return (
    <ColumnFilter
      active={active}
      title={t("severityHeading")}
      description={t("severityColumnDescription")}
      triggerAriaLabel={t("columnFilterAriaLabel", { column: columnLabel })}
      onClear={active ? () => onChange({ severities: [] }) : undefined}
      clearLabel={t("clearFilter")}
    >
      <SeverityFunnelBody filters={filters} onChange={onChange} />
    </ColumnFilter>
  );
}
