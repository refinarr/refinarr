"use client";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Badge } from "@/client/components/ui/badge";
import type { FilterChip } from "@/client/components/common/ActiveFilterChips/ActiveFilterChips";

interface Props {
  chips: FilterChip[];
  onClearAll?: () => void;
}

export function LogFilterChips({ chips, onClearAll }: Props) {
  const tChips = useTranslations("logs.chips");
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <Badge
          key={chip.key}
          variant="secondary"
          className="gap-1 py-0.5 pr-1 pl-2"
        >
          <span className="text-xs">{chip.label}</span>
          <button
            type="button"
            onClick={chip.onRemove}
            className="hover:bg-background/40 rounded-sm p-0.5"
            aria-label={tChips("removeAriaLabel", { label: chip.label })}
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}
      {onClearAll && (
        <button
          type="button"
          onClick={onClearAll}
          className="text-muted-foreground hover:text-foreground ml-1 text-xs"
        >
          {tChips("clearAll")}
        </button>
      )}
    </div>
  );
}
