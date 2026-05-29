"use client";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Input } from "@/client/components/ui/input";
import type { MediaFilters } from "@/client/hooks/media/useMediaFilters";

interface Props {
  filters: MediaFilters;
  onChange: (next: Partial<MediaFilters>) => void;
}

// Title-search input. The "Only missing" toggle has its own home —
// MobileFilterBar on small screens, MediaListShell's quick-toggles row
// on md+ — so it isn't duplicated here. Per-column filters (profile,
// score, size, severity, CFs) live in the table column headers via
// ColumnFilter funnels — see movieColumns / seriesColumns for the
// wiring. `flaggedOnly` is driven exclusively by `instance.showAllMedia`
// (DB setting → useMediaFilters); to switch a library between
// flagged-only and all-media, use the "Show all media" toggle in
// InstanceCard.
export function MediaSearchBar({ filters, onChange }: Props) {
  const t = useTranslations("filters");
  return (
    <div className="relative">
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input
        value={filters.q}
        onChange={(e) => onChange({ q: e.target.value })}
        placeholder={t("searchPlaceholder")}
        className="pl-9"
      />
    </div>
  );
}
