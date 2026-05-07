"use client";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Search, ChevronDown, Check } from "lucide-react";
import { Input } from "@/client/components/ui/input";
import { Slider } from "@/client/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import { MultiSelect } from "@/client/components/ui/multi-select";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/client/components/ui/popover";
import { useQualityProfiles } from "@/client/hooks/data/useQualityProfiles";
import { usePreferences } from "@/client/hooks/data/usePreferences";
import { cn } from "@/client/lib/utils";
import type { MediaFilters } from "@/client/hooks/media/useMediaFilters";
import { isManualMode } from "@/shared/scoring-mode";
import type { ArrType, ScoringMode } from "@/shared/types/models";

interface Props {
  arrType: ArrType;
  instanceId: number;
  scoringMode: ScoringMode;
  filters: MediaFilters;
  onChange: (next: Partial<MediaFilters>) => void;
}

const ALL = "__all__";

// Shared pill style for every filter trigger so they line up visually.
// Visual-only — height comes from the primitive (SelectTrigger /
// MultiSelect default to h-control-sm). Raw <button>/<PopoverTrigger>
// callers below add h-control-sm directly so they line up with the
// primitives.
const PILL =
  "inline-flex items-center gap-1.5 rounded-full border border-input bg-transparent px-3 text-xs font-medium whitespace-nowrap transition-colors hover:bg-accent/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none dark:bg-input/30 dark:hover:bg-input/50";
const PILL_ACTIVE =
  "border-primary bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-primary dark:hover:bg-primary/90";

export function MediaSearchBar({
  arrType,
  instanceId,
  scoringMode,
  filters,
  onChange,
}: Props) {
  const t = useTranslations("filters");
  const { data: profiles } = useQualityProfiles(arrType, instanceId);
  const { data: prefs } = usePreferences(instanceId);

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

  const profileName = profiles?.find((p) => p.id === filters.profileId)?.name;

  const profileActive = filters.profileId !== null;
  const maxScoreActive = isManualMode(scoringMode) && filters.maxScore < 1;
  const onlyMissingActive = filters.onlyMissing;
  const anyActive =
    profileActive ||
    filters.missingCfIds.length > 0 ||
    filters.hasNegativeCfIds.length > 0 ||
    maxScoreActive ||
    onlyMissingActive ||
    filters.q !== "";

  const clearAll = () =>
    onChange({
      q: "",
      profileId: null,
      missingCfIds: [],
      hasNegativeCfIds: [],
      maxScore: 1,
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
        <Select
          value={filters.profileId === null ? ALL : String(filters.profileId)}
          onValueChange={(v) =>
            onChange({ profileId: v === ALL ? null : Number(v) })
          }
        >
          <SelectTrigger className={cn(PILL, profileActive && PILL_ACTIVE)}>
            <SelectValue>
              {profileActive
                ? t("profileLabel", { name: profileName ?? "" })
                : t("allProfiles")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("allProfiles")}</SelectItem>
            {(profiles ?? []).map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isManualMode(scoringMode) ? (
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
            triggerClassName={cn(
              PILL,
              filters.missingCfIds.length > 0 && PILL_ACTIVE,
            )}
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
            triggerClassName={cn(
              PILL,
              filters.hasNegativeCfIds.length > 0 && PILL_ACTIVE,
            )}
          />
        )}

        {isManualMode(scoringMode) && (
          <Popover>
            <PopoverTrigger
              className={cn(
                "h-control-sm",
                PILL,
                maxScoreActive && PILL_ACTIVE,
              )}
            >
              {t("maxScore")}: {Math.round(filters.maxScore * 100)}%
              <ChevronDown className="size-3 opacity-60" />
            </PopoverTrigger>
            <PopoverContent className="w-64">
              <div className="flex items-center gap-3">
                <Slider
                  value={filters.maxScore}
                  onValueChange={(v) => {
                    const next = typeof v === "number" ? v : v[0];
                    if (typeof next === "number") onChange({ maxScore: next });
                  }}
                  min={0}
                  max={1}
                  step={0.05}
                  className="flex-1"
                />
                <span className="w-10 text-right text-xs tabular-nums">
                  {Math.round(filters.maxScore * 100)}%
                </span>
              </div>
            </PopoverContent>
          </Popover>
        )}

        <button
          type="button"
          aria-pressed={onlyMissingActive}
          onClick={() => onChange({ onlyMissing: !filters.onlyMissing })}
          className={cn("h-control-sm", PILL, onlyMissingActive && PILL_ACTIVE)}
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
