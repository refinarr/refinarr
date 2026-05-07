"use client";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import type {
  MatchMode,
  MediaFilters,
} from "@/client/hooks/media/useMediaFilters";
import { cn } from "@/client/lib/utils";
import { isManualMode } from "@/shared/scoring-mode";
import type { ScoringMode } from "@/shared/types/models";
import { ColumnFilter } from "./ColumnFilter";

export interface CfOption {
  id: number;
  name: string;
}

interface BodyProps {
  scoringMode: ScoringMode;
  options: CfOption[];
  filters: MediaFilters;
  onChange: (patch: Partial<MediaFilters>) => void;
}

// In manual mode the active filter is `missingCfIds` + `missingCfMatch`
// — "show me items missing any/all of these CFs".
// In profile mode it's `hasNegativeCfIds` + `hasNegativeCfMatch` —
// "show me items that have any/all of these penalty CFs".
// Single state machine, just bound to a different filter slice.
export function CfFunnelBody({
  scoringMode,
  options,
  filters,
  onChange,
}: BodyProps) {
  const t = useTranslations("filters");
  const manual = isManualMode(scoringMode);
  const selected = manual ? filters.missingCfIds : filters.hasNegativeCfIds;
  const matchMode: MatchMode = manual
    ? filters.missingCfMatch
    : filters.hasNegativeCfMatch;
  const setSelected = (next: number[]) =>
    onChange(manual ? { missingCfIds: next } : { hasNegativeCfIds: next });
  const setMatchMode = (next: MatchMode) =>
    onChange(manual ? { missingCfMatch: next } : { hasNegativeCfMatch: next });
  const toggle = (id: number) =>
    setSelected(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    );
  if (options.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">{t("noFormatsAvailable")}</p>
    );
  }
  return (
    <>
      <div
        role="radiogroup"
        aria-label={t("matchModeAriaLabel")}
        className="flex gap-1 rounded-md border p-0.5"
      >
        <MatchToggle
          value="all"
          current={matchMode}
          onSelect={setMatchMode}
          label={t("matchAll")}
        />
        <MatchToggle
          value="any"
          current={matchMode}
          onSelect={setMatchMode}
          label={t("matchAny")}
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const on = selected.includes(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(opt.id)}
              className={cn(
                "h-control-xs inline-flex items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-colors",
                on
                  ? "border-brand bg-brand text-foreground-on-brand"
                  : "border-input text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {on && <Check className="size-3" />}
              <span className="truncate">{opt.name}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

interface Props extends BodyProps {
  // Plain text label of the column this funnel sits in — used by the
  // a11y trigger label ("Filter Custom Formats").
  columnLabel: string;
}

// Funnel for the "issues" / Custom-Formats column header. Wraps
// CfFunnelBody in the popover-style ColumnFilter primitive.
export function CfColumnFunnel({
  scoringMode,
  options,
  filters,
  onChange,
  columnLabel,
}: Props) {
  const t = useTranslations("filters");
  const manual = isManualMode(scoringMode);
  const selected = manual ? filters.missingCfIds : filters.hasNegativeCfIds;
  const active = selected.length > 0;
  const title = manual ? t("missingHeading") : t("penaltyHeading");
  const description = manual
    ? t("missingColumnDescription")
    : t("penaltyColumnDescription");
  const clear = () =>
    onChange(
      manual
        ? { missingCfIds: [], missingCfMatch: "all" }
        : { hasNegativeCfIds: [], hasNegativeCfMatch: "all" },
    );
  return (
    <ColumnFilter
      active={active}
      title={title}
      description={description}
      triggerAriaLabel={t("columnFilterAriaLabel", { column: columnLabel })}
      onClear={active ? clear : undefined}
      clearLabel={t("clearFilter")}
    >
      <CfFunnelBody
        scoringMode={scoringMode}
        options={options}
        filters={filters}
        onChange={onChange}
      />
    </ColumnFilter>
  );
}

interface MatchToggleProps {
  value: MatchMode;
  current: MatchMode;
  onSelect: (v: MatchMode) => void;
  label: string;
}

function MatchToggle({ value, current, onSelect, label }: MatchToggleProps) {
  const selected = current === value;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => onSelect(value)}
      className={cn(
        "flex-1 rounded-sm px-2 py-1 text-xs font-medium transition-colors",
        selected
          ? "bg-brand text-foreground-on-brand"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
