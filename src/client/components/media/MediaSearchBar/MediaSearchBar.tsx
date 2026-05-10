"use client";
import { useTranslations } from "next-intl";
import { Search, Check } from "lucide-react";
import { Input } from "@/client/components/ui/input";
import { cn } from "@/client/lib/utils";
import type { MediaFilters } from "@/client/hooks/media/useMediaFilters";

interface Props {
  filters: MediaFilters;
  onChange: (next: Partial<MediaFilters>) => void;
}

// Visual-only pill style for the always-visible quick toggle. Form-control
// sizing comes from h-control-sm so the pill lines up with primitives
// elsewhere in the app.
const PILL =
  "inline-flex h-control-sm items-center gap-1.5 rounded-full border border-input bg-transparent px-3 text-xs font-medium whitespace-nowrap transition-colors hover:bg-accent/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none dark:bg-input/30 dark:hover:bg-input/50";
const PILL_ACTIVE =
  "border-primary bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-primary dark:hover:bg-primary/90";

// Filter strip above the table. Title-search input + the "only missing"
// toggle. Per-column filters (profile, score, size, severity, CFs) live
// in the table column headers via ColumnFilter funnels — see
// movieColumns / seriesColumns for the wiring.
//
// `flaggedOnly` is driven exclusively by `instance.showAllMedia` (DB
// setting → useMediaFilters), so there is no per-page override here.
// To switch a library between flagged-only and all-media, use the
// "Show all media" toggle in the InstanceCard.
export function MediaSearchBar({ filters, onChange }: Props) {
  const t = useTranslations("filters");
  const onlyMissingActive = filters.onlyMissing;
  const anyActive =
    filters.profileIds.length > 0 ||
    filters.severities.length > 0 ||
    filters.missingCfIds.length > 0 ||
    filters.hasNegativeCfIds.length > 0 ||
    filters.minScore !== null ||
    filters.maxScore !== null ||
    filters.minSize !== null ||
    filters.maxSize !== null ||
    onlyMissingActive ||
    filters.q !== "";

  const clearAll = () =>
    onChange({
      q: "",
      profileIds: [],
      severities: [],
      minScore: null,
      maxScore: null,
      minSize: null,
      maxSize: null,
      missingCfIds: [],
      missingCfMatch: "all",
      hasNegativeCfIds: [],
      hasNegativeCfMatch: "all",
      onlyMissing: false,
    });

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          value={filters.q}
          onChange={(e) => onChange({ q: e.target.value })}
          placeholder={t("searchPlaceholder")}
          className="pl-9"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/*
          The Only-missing pill is desktop-only. On mobile the same
          toggle lives in MobileFilterBar so the search bar stays
          tight and one-handed reachability is preserved.
        */}
        <button
          type="button"
          aria-pressed={onlyMissingActive}
          onClick={() => onChange({ onlyMissing: !filters.onlyMissing })}
          className={cn(
            "hidden md:inline-flex",
            PILL,
            onlyMissingActive && PILL_ACTIVE,
          )}
        >
          {onlyMissingActive && <Check className="size-3" />}
          {t("onlyMissing")}
        </button>

        {anyActive && (
          <button
            type="button"
            onClick={clearAll}
            className="text-muted-foreground hover:text-foreground ml-1 text-xs"
          >
            {t("clearAll")}
          </button>
        )}
      </div>
    </div>
  );
}
