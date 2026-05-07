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

interface Props {
  scoringMode: ScoringMode;
  options: CfOption[];
  filters: MediaFilters;
  onChange: (patch: Partial<MediaFilters>) => void;
  // Plain text label of the column this funnel sits in — used by the
  // a11y trigger label ("Filter Custom Formats").
  columnLabel: string;
}

// Funnel for the "issues" / Custom-Formats column.
//
// In manual mode the active filter is `missingCfIds` + `missingCfMatch`
// — "show me items missing any/all of these CFs".
// In profile mode it's `hasNegativeCfIds` + `hasNegativeCfMatch` —
// "show me items that have any/all of these penalty CFs".
//
// Both render as a wrap of toggleable chips inside the popover plus
// an Any/All match-mode toggle. Single state machine, just bound to
// a different filter slice.
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
  const matchMode: MatchMode = manual
    ? filters.missingCfMatch
    : filters.hasNegativeCfMatch;
  const setSelected = (next: number[]) =>
    onChange(manual ? { missingCfIds: next } : { hasNegativeCfIds: next });
  const setMatchMode = (next: MatchMode) =>
    onChange(manual ? { missingCfMatch: next } : { hasNegativeCfMatch: next });
  const clear = () =>
    onChange(
      manual
        ? { missingCfIds: [], missingCfMatch: "all" }
        : { hasNegativeCfIds: [], hasNegativeCfMatch: "all" },
    );

  const toggle = (id: number) =>
    setSelected(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    );

  const active = selected.length > 0;
  const title = manual ? t("missingHeading") : t("penaltyHeading");
  const description = manual
    ? t("missingColumnDescription")
    : t("penaltyColumnDescription");

  return (
    <ColumnFilter
      active={active}
      title={title}
      description={description}
      triggerAriaLabel={t("columnFilterAriaLabel", { column: columnLabel })}
      onClear={active ? clear : undefined}
      clearLabel={t("clearFilter")}
    >
      {options.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          {t("noFormatsAvailable")}
        </p>
      ) : (
        <>
          <div className="flex gap-1 rounded-md border p-0.5">
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
      )}
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
