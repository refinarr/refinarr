"use client";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Checkbox } from "@/client/components/ui/checkbox";
import { cn } from "@/client/lib/utils";

interface Props<T extends { id: number }> {
  row: T;
  selected: boolean;
  onToggleSelect: () => void;
  onRowClick: () => void;
  renderCard: (row: T) => ReactNode;
  actions?: ReactNode;
  // True when this card is the deep-link target. Drives the focus
  // animation directly on the card's rounded root so the highlight
  // follows the card's border-radius instead of the wrapper's square.
  focused?: boolean;
}

export function MediaCard<T extends { id: number }>({
  row,
  selected,
  onToggleSelect,
  onRowClick,
  renderCard,
  actions,
  focused,
}: Props<T>) {
  return (
    <li
      className={cn(
        "bg-card hover:bg-muted/40 rounded-lg border transition-colors",
        focused && "media-row-focused",
      )}
    >
      <div
        className="flex cursor-pointer items-start gap-3 p-3"
        onClick={onRowClick}
      >
        <span
          className="pt-0.5"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect();
          }}
        >
          <Checkbox checked={selected} onCheckedChange={onToggleSelect} />
        </span>
        <div className="min-w-0 flex-1">{renderCard(row)}</div>
        <ChevronRight className="text-muted-foreground mt-0.5 size-4 shrink-0" />
      </div>
      {actions && (
        <div
          className="flex items-center gap-2 border-t px-3 py-2"
          onClick={(e) => e.stopPropagation()}
        >
          {actions}
        </div>
      )}
    </li>
  );
}
