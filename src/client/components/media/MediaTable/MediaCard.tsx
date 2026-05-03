"use client";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Checkbox } from "@/client/components/ui/checkbox";

interface Props<T extends { id: number }> {
  row: T;
  selected: boolean;
  onToggleSelect: () => void;
  onRowClick: () => void;
  renderCard: (row: T) => ReactNode;
  actions?: ReactNode;
}

export function MediaCard<T extends { id: number }>({
  row,
  selected,
  onToggleSelect,
  onRowClick,
  renderCard,
  actions,
}: Props<T>) {
  return (
    <li className="rounded-lg border bg-card transition-colors hover:bg-muted/40">
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
        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
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
