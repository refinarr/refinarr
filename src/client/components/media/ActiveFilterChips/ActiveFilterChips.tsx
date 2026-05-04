"use client";
import { useTranslations } from "next-intl";
import { Badge } from "@/client/components/ui/badge";
import { X } from "lucide-react";

export interface FilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

// Helper for building per-CF filter chips (missing-CF / penalty-CF). Lives at
// module scope so its inner functions don't count toward the call site's
// nesting depth.
export function buildCfChips(args: {
  ids: number[];
  options: { id: number; name: string }[];
  label: (name: string) => string;
  removeId: (id: number) => void;
  keyPrefix: string;
}): FilterChip[] {
  return args.ids
    .map((id): FilterChip | null => {
      const name = args.options.find((c) => c.id === id)?.name;
      return name
        ? {
            key: `${args.keyPrefix}-${id}`,
            label: args.label(name),
            onRemove: () => args.removeId(id),
          }
        : null;
    })
    .filter((c): c is FilterChip => c !== null);
}

interface Props {
  chips: FilterChip[];
}

export function ActiveFilterChips({ chips }: Props) {
  const t = useTranslations("filters");
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{t("active")}</span>
      {chips.map((chip) => (
        <Badge key={chip.key} variant="secondary" className="gap-1 pl-2 pr-1 py-0.5">
          <span className="text-xs">{chip.label}</span>
          <button
            type="button"
            onClick={chip.onRemove}
            className="rounded hover:bg-background/40 p-0.5"
            aria-label={t("removeChip", { label: chip.label })}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
    </div>
  );
}
