"use client";
import type { ComponentType } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("settings");
  return (
    <nav
      aria-label={t("navAriaLabel")}
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
              "focus-visible:ring-ring relative flex items-center gap-2 rounded-md border-l-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
              selected
                ? "border-primary bg-primary/10 text-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground border-transparent",
            )}
          >
            <Icon
              className={cn(
                "size-4 transition-colors",
                selected && "text-primary",
              )}
            />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
