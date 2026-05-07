"use client";
import { useTranslations } from "next-intl";
import type { MediaFilters } from "@/client/hooks/media/useMediaFilters";
import type { QualityProfile } from "@/shared/types/models";
import { ColumnFilter } from "./ColumnFilter";
import { FilterChipButton } from "./FilterChipButton";

interface BodyProps {
  profiles: QualityProfile[] | undefined;
  filters: MediaFilters;
  onChange: (patch: Partial<MediaFilters>) => void;
}

export function ProfileFunnelBody({ profiles, filters, onChange }: BodyProps) {
  const t = useTranslations("filters");
  const selected = filters.profileIds;
  const toggle = (id: number) =>
    onChange({
      profileIds: selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    });
  if (!profiles || profiles.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        {t("noProfilesAvailable")}
      </p>
    );
  }
  return (
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
  );
}

interface Props extends BodyProps {
  columnLabel: string;
}

export function ProfileColumnFunnel({
  profiles,
  filters,
  onChange,
  columnLabel,
}: Props) {
  const t = useTranslations("filters");
  const active = filters.profileIds.length > 0;
  return (
    <ColumnFilter
      active={active}
      title={t("profileHeading")}
      description={t("profileColumnDescription")}
      triggerAriaLabel={t("columnFilterAriaLabel", { column: columnLabel })}
      onClear={active ? () => onChange({ profileIds: [] }) : undefined}
      clearLabel={t("clearFilter")}
    >
      <ProfileFunnelBody
        profiles={profiles}
        filters={filters}
        onChange={onChange}
      />
    </ColumnFilter>
  );
}
