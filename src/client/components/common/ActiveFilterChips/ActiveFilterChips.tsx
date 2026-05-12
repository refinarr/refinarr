"use client";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Badge } from "@/client/components/ui/badge";

export interface FilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

interface Props {
  chips: FilterChip[];
  // Optional reset action shown after the chip list. Hidden when no
  // chips are active so the strip stays tidy when nothing is set.
  onClearAll?: () => void;
}

export function ActiveFilterChips({ chips, onClearAll }: Props) {
  const t = useTranslations("filters");
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-muted-foreground text-xs">{t("active")}</span>
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
            aria-label={t("removeChip", { label: chip.label })}
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
          {t("clearAll")}
        </button>
      )}
    </div>
  );
}
