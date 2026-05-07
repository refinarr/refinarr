"use client";
import { useTranslations } from "next-intl";
import type { MediaFilters } from "@/client/hooks/media/useMediaFilters";
import type { QualityProfile } from "@/shared/types/models";
import { ColumnFilter } from "./ColumnFilter";
import { FilterChipButton } from "./FilterChipButton";

interface Props {
  profiles: QualityProfile[] | undefined;
  filters: MediaFilters;
  onChange: (patch: Partial<MediaFilters>) => void;
  columnLabel: string;
}

export function ProfileColumnFunnel({
  profiles,
  filters,
  onChange,
  columnLabel,
}: Props) {
  const t = useTranslations("filters");
  const selected = filters.profileIds;
  const active = selected.length > 0;
  const toggle = (id: number) =>
    onChange({
      profileIds: selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    });

  return (
    <ColumnFilter
      active={active}
      title={t("profileHeading")}
      description={t("profileColumnDescription")}
      triggerAriaLabel={t("columnFilterAriaLabel", { column: columnLabel })}
      onClear={active ? () => onChange({ profileIds: [] }) : undefined}
      clearLabel={t("clearFilter")}
    >
      {!profiles || profiles.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          {t("noProfilesAvailable")}
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {profiles.map((p) => (
            <FilterChipButton
              key={p.id}
              label={p.name}
              selected={selected.includes(p.id)}
              onClick={() => toggle(p.id)}
            />
          ))}
        </div>
      )}
    </ColumnFilter>
  );
}
