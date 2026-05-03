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
  const showMatchToggle = matchMode !== undefined && onMatchModeChange !== undefined;

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
          "flex h-8 w-fit items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50",
          selected.length === 0 && "text-muted-foreground",
          triggerClassName,
          className,
        )}
      >
        <span className="line-clamp-1 flex flex-1 items-center gap-1.5 text-left">{triggerText}</span>
        <ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-[--anchor-width]">
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
              onValueChange={(v) => onMatchModeChange?.(v as MultiSelectMatchMode)}
            >
              <DropdownMenuRadioItem value="all" onSelect={(e) => e.preventDefault()}>
                {matchAllLabel}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="any" onSelect={(e) => e.preventDefault()}>
                {matchAnyLabel}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
          </>
        )}
        {options.length === 0 ? (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">No options</div>
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
