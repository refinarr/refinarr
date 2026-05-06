"use client";
import { ChevronDownIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from "@/client/components/ui/dropdown-menu";
import { cn } from "@/client/lib/utils";

export type MultiSelectMatchMode = "any" | "all";

export interface MultiSelectOption {
  id: number;
  name: string;
}

interface Props {
  options: MultiSelectOption[];
  selected: number[];
  onChange: (next: number[]) => void;
  placeholder: string;
  // Heading rendered above the list (e.g. "Missing Custom Format").
  label?: string;
  // Trigger label shown when selected.length === 1 — receives the option name.
  singleLabel?: (name: string) => string;
  // Trigger label shown when selected.length > 1 — receives the count.
  multiLabel?: (count: number) => string;
  // When provided, renders a small "Any / All" radio at the top of the
  // dropdown and appends a faint suffix (e.g. "· any") to the multi-label.
  matchMode?: MultiSelectMatchMode;
  onMatchModeChange?: (next: MultiSelectMatchMode) => void;
  matchAnyLabel?: string;
  matchAllLabel?: string;
  matchAnySuffix?: string;
  matchAllSuffix?: string;
  className?: string;
  triggerClassName?: string;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder,
  label,
  singleLabel = (name) => name,
  multiLabel = (count) => `${count} selected`,
  matchMode,
  onMatchModeChange,
  matchAnyLabel = "Match any",
  matchAllLabel = "Match all",
  matchAnySuffix = "any",
  matchAllSuffix = "all",
  className,
  triggerClassName,
}: Props) {
  const showMatchToggle =
    matchMode !== undefined && onMatchModeChange !== undefined;

  const triggerText = (() => {
    if (selected.length === 0) return placeholder;
    if (selected.length === 1) {
      const opt = options.find((o) => o.id === selected[0]);
      return opt ? singleLabel(opt.name) : placeholder;
    }
    const base = multiLabel(selected.length);
    if (!showMatchToggle) return base;
    const suffix = matchMode === "all" ? matchAllSuffix : matchAnySuffix;
    return `${base} · ${suffix}`;
  })();

  const toggle = (id: number) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else onChange([...selected, id]);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          // Placeholder text intentionally NOT muted — empty filter
          // chips read at the same weight as the other filter triggers
          // sitting next to them, since both represent the "no-filter"
          // default state.
          "border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50 h-control-sm flex w-fit items-center justify-between gap-1.5 rounded-lg border bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50",
          triggerClassName,
          className,
        )}
      >
        <span className="line-clamp-1 flex flex-1 items-center gap-1.5 text-left">
          {triggerText}
        </span>
        <ChevronDownIcon className="text-muted-foreground pointer-events-none size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-80 min-w-56">
        {label && (
          <DropdownMenuGroup>
            <DropdownMenuLabel>{label}</DropdownMenuLabel>
            <DropdownMenuSeparator />
          </DropdownMenuGroup>
        )}
        {showMatchToggle && (
          <>
            <DropdownMenuRadioGroup
              value={matchMode}
              onValueChange={(v) =>
                onMatchModeChange?.(v as MultiSelectMatchMode)
              }
            >
              <DropdownMenuRadioItem
                value="all"
                onSelect={(e) => e.preventDefault()}
              >
                {matchAllLabel}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem
                value="any"
                onSelect={(e) => e.preventDefault()}
              >
                {matchAnyLabel}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
          </>
        )}
        {options.length === 0 ? (
          <div className="text-muted-foreground px-2 py-1.5 text-sm">
            No options
          </div>
        ) : (
          options.map((opt) => (
            <DropdownMenuCheckboxItem
              key={opt.id}
              checked={selected.includes(opt.id)}
              onCheckedChange={() => toggle(opt.id)}
              onSelect={(e) => e.preventDefault()}
            >
              {opt.name}
            </DropdownMenuCheckboxItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
