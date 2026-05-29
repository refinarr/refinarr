"use client";
import { Check, type LucideIcon } from "lucide-react";
import { cn } from "@/client/lib/utils";

function renderLeading(selected: boolean, Icon: LucideIcon | undefined) {
  if (selected) return <Check className="size-3" />;
  if (Icon) return <Icon className="size-3" />;
  return null;
}

interface Props {
  // Visible chip label (translated by caller).
  label: string;
  // Optional leading icon — used by SeverityColumnFunnel for the dot.
  icon?: LucideIcon;
  selected: boolean;
  onClick: () => void;
  // Per-chip color override (e.g. severity buckets render with their
  // semantic surface). Defaults to the brand-tinted active style.
  selectedClassName?: string;
}

// Toggleable chip used inside ColumnFilter popovers (CF, severity,
// profile). Single style source so the funnels stay visually consistent.
export function FilterChipButton({
  label,
  icon: Icon,
  selected,
  onClick,
  selectedClassName,
}: Props) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "h-control-xs inline-flex items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-colors",
        selected
          ? (selectedClassName ??
              "border-brand bg-brand text-foreground-on-brand")
          : "border-input text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {renderLeading(selected, Icon)}
      <span className="truncate">{label}</span>
    </button>
  );
}
