"use client";
import type { ComponentType } from "react";
import { cn } from "@/client/lib/utils";

export interface SettingsRailItem {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

interface Props {
  items: SettingsRailItem[];
  active: string;
  onSelect: (id: string) => void;
  className?: string;
}

export function SettingsRail({ items, active, onSelect, className }: Props) {
  return (
    <nav
      aria-label="Settings sections"
      className={cn("flex w-56 shrink-0 flex-col gap-1 self-start", className)}
    >
      {items.map(({ id, label, icon: Icon }) => {
        const selected = active === id;
        return (
          <button
            key={id}
            type="button"
            aria-current={selected ? "true" : undefined}
            onClick={() => onSelect(id)}
            className={cn(
              "focus-visible:ring-ring flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
              selected
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
