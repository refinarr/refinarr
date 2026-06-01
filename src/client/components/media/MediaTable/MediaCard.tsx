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
  // follows the card's border-radius.
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
  // Single compact block: checkbox · content (flex-1) · actions + chevron.
  // The old design parked the actions in a full-width bordered footer row
  // that was ~half empty and ~doubled card height; inlining them on the
  // right (revealed on hover for fine pointers, always shown on touch via
  // pointer-coarse) reclaims that space. Actions stay rendered (opacity
  // toggled, not display) so hovering never reflows the row.
  return (
    <li
      className={cn(
        "group bg-card hover:bg-muted/40 flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
        focused && "media-row-focused",
      )}
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
      <div className="flex shrink-0 items-center gap-0.5 self-center">
        {actions && (
          <span
            className="flex items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            {actions}
          </span>
        )}
        <ChevronRight className="text-muted-foreground size-4 shrink-0" />
      </div>
    </li>
  );
}
