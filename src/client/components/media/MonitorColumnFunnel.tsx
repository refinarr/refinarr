"use client";
import { useTranslations } from "next-intl";
import type { MediaFilters } from "@/client/hooks/media/useMediaFilters";
import type { MonitorStatus } from "@/shared/types/models";
import { ColumnFilter } from "./ColumnFilter";
import { FilterChipButton } from "./FilterChipButton";

const ORDER: MonitorStatus[] = ["all", "monitored", "unmonitored", "missing"];

interface BodyProps {
  filters: MediaFilters;
  onChange: (patch: Partial<MediaFilters>) => void;
}

// Single-select chip group — clicking a value sets monitorStatus to it.
// Mirrors SeverityColumnFunnel's body pattern but with radio (single)
// rather than checkbox (multi) semantics. Reused by both the column
// funnel popover here and the mobile FilterSheet so the picker UX stays
// identical across viewports.
export function MonitorFunnelBody({ filters, onChange }: BodyProps) {
  const t = useTranslations("filters.monitorStatus");
  const selected = filters.monitorStatus;
  return (
    <div className="flex flex-wrap gap-1.5">
      {ORDER.map((value) => (
        <FilterChipButton
          key={value}
          label={t(value)}
          selected={selected === value}
          onClick={() => onChange({ monitorStatus: value })}
        />
      ))}
    </div>
  );
}

interface Props extends BodyProps {
  columnLabel: string;
}

export function MonitorColumnFunnel({ filters, onChange, columnLabel }: Props) {
  const t = useTranslations("filters");
  const tStatus = useTranslations("filters.monitorStatus");
  const active = filters.monitorStatus !== "all";
  return (
    <ColumnFilter
      active={active}
      title={tStatus("label")}
      description={tStatus("description")}
      triggerAriaLabel={t("columnFilterAriaLabel", { column: columnLabel })}
      onClear={active ? () => onChange({ monitorStatus: "all" }) : undefined}
      clearLabel={t("clearFilter")}
    >
      <MonitorFunnelBody filters={filters} onChange={onChange} />
    </ColumnFilter>
  );
}
