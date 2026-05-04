"use client";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/client/components/ui/input";
import { Slider } from "@/client/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/client/components/ui/select";
import { MultiSelect } from "@/client/components/ui/multi-select";
import { Button } from "@/client/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/client/components/ui/sheet";
import { Search, SlidersHorizontal } from "lucide-react";
import { useQualityProfiles } from "@/client/hooks/data/useQualityProfiles";
import { usePreferences } from "@/client/hooks/data/usePreferences";
import type { ArrType, ScoringMode } from "@/shared/types/models";
import type { MediaFilters } from "@/client/hooks/media/useMediaFilters";
import type { QualityProfile } from "@/shared/types/models";

interface Props {
  arrType: ArrType;
  instanceId: number;
  scoringMode: ScoringMode;
  filters: MediaFilters;
  onChange: (next: Partial<MediaFilters>) => void;
}

interface CfOption {
  id: number;
  name: string;
}

const ALL = "__all__";

interface ControlsProps {
  scoringMode: ScoringMode;
  profiles: QualityProfile[] | undefined;
  wantedCfOptions: CfOption[];
  negativeCfOptions: CfOption[];
  filters: MediaFilters;
  onChange: (next: Partial<MediaFilters>) => void;
}

function FilterControls({
  scoringMode,
  profiles,
  wantedCfOptions,
  negativeCfOptions,
  filters,
  onChange,
}: ControlsProps) {
  const t = useTranslations("filters");
  return (
    <>
      <Select
        value={filters.profileId === null ? ALL : String(filters.profileId)}
        onValueChange={(v) => onChange({ profileId: v === ALL ? null : Number(v) })}
      >
        <SelectTrigger className="w-full md:w-44">
          <SelectValue>
            {filters.profileId === null
              ? t("allProfiles")
              : profiles?.find((p) => p.id === filters.profileId)?.name ?? "Profile"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("allProfiles")}</SelectItem>
          {(profiles ?? []).map((p) => (
            <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {scoringMode === "manual" ? (
        <MultiSelect
          options={wantedCfOptions}
          selected={filters.missingCfIds}
          onChange={(next) => onChange({ missingCfIds: next })}
          placeholder={t("anyMissingFormat")}
          label={t("missingHeading")}
          singleLabel={(name) => t("missingLabel", { name })}
          multiLabel={(count) => t("missingMultiLabel", { count })}
          matchMode={filters.missingCfMatch}
          onMatchModeChange={(m) => onChange({ missingCfMatch: m })}
          matchAnyLabel={t("matchAny")}
          matchAllLabel={t("matchAll")}
          matchAnySuffix={t("matchAnySuffix")}
          matchAllSuffix={t("matchAllSuffix")}
          triggerClassName="w-full md:w-56"
        />
      ) : (
        <MultiSelect
          options={negativeCfOptions}
          selected={filters.hasNegativeCfIds}
          onChange={(next) => onChange({ hasNegativeCfIds: next })}
          placeholder={t("anyPenaltyFormat")}
          label={t("penaltyHeading")}
          singleLabel={(name) => t("penaltyLabel", { name })}
          multiLabel={(count) => t("penaltyMultiLabel", { count })}
          matchMode={filters.hasNegativeCfMatch}
          onMatchModeChange={(m) => onChange({ hasNegativeCfMatch: m })}
          matchAnyLabel={t("matchAny")}
          matchAllLabel={t("matchAll")}
          matchAnySuffix={t("matchAnySuffix")}
          matchAllSuffix={t("matchAllSuffix")}
          triggerClassName="w-full md:w-56"
        />
      )}

      {scoringMode === "manual" && (
        <div className="flex w-full items-center gap-2 md:w-48 md:min-w-48">
          <span className="whitespace-nowrap text-xs text-muted-foreground">{t("maxScore")}</span>
          <Slider
            value={filters.maxScore}
            onValueChange={(v) => onChange({ maxScore: v as number })}
            min={0}
            max={1}
            step={0.05}
            className="flex-1"
          />
          <span className="w-10 text-right text-xs tabular-nums">{Math.round(filters.maxScore * 100)}%</span>
        </div>
      )}
    </>
  );
}

function activeFilterCount(filters: MediaFilters, scoringMode: ScoringMode): number {
  let n = 0;
  if (filters.profileId !== null) n++;
  if (scoringMode === "manual" && filters.missingCfIds.length > 0) n++;
  if (scoringMode === "profile" && filters.hasNegativeCfIds.length > 0) n++;
  if (scoringMode === "manual" && filters.maxScore < 1) n++;
  return n;
}

export function MediaSearchBar({ arrType, instanceId, scoringMode, filters, onChange }: Props) {
  const t = useTranslations("filters");
  const { data: profiles } = useQualityProfiles(arrType, instanceId);
  const { data: prefs } = usePreferences(instanceId);
  const [sheetOpen, setSheetOpen] = useState(false);

  const wantedCfOptions = useMemo(
    () => (prefs ?? []).map((p) => ({ id: p.cfId, name: p.cfName })),
    [prefs],
  );

  const negativeCfOptions = useMemo(() => {
    const pairs = (profiles ?? [])
      .flatMap((p) => p.formatItems ?? [])
      .filter((item) => item.score < 0)
      .map((item) => [item.format, item.name] as const);
    return Array.from(new Map(pairs), ([id, name]) => ({ id, name }));
  }, [profiles]);

  const controlsProps: ControlsProps = {
    scoringMode,
    profiles,
    wantedCfOptions,
    negativeCfOptions,
    filters,
    onChange,
  };

  const activeCount = activeFilterCount(filters, scoringMode);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-0 flex-1 md:min-w-64">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.q}
          onChange={(e) => onChange({ q: e.target.value })}
          placeholder={t("searchPlaceholder")}
          className="pl-9"
        />
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="md:hidden"
        onClick={() => setSheetOpen(true)}
      >
        <SlidersHorizontal className="mr-1 h-4 w-4" />
        {t("openFilters")}
        {activeCount > 0 && (
          <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
            {activeCount}
          </span>
        )}
      </Button>

      <div className="hidden flex-wrap items-center gap-3 md:flex">
        <FilterControls {...controlsProps} />
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="bottom"
          className="flex max-h-[80vh] flex-col gap-4 px-4 py-4 md:hidden"
        >
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription className="sr-only">{t("openFilters")}</SheetDescription>
          <div className="flex flex-col gap-3 overflow-y-auto">
            <FilterControls {...controlsProps} />
          </div>
          <SheetClose
            render={
              <Button type="button" variant="default" className="w-full">
                {t("applyFilters")}
              </Button>
            }
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
