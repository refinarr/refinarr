"use client";
import { useTranslations } from "next-intl";
import { LayoutGrid, Rows3, Rows4 } from "lucide-react";
import { useDensity, type Density } from "@/client/hooks/ui/useDensity";

interface ModeMeta {
  Icon: typeof Rows3;
  i18nKey: "cozy" | "compact" | "card" | "poster";
}

// Visual + label metadata for each density mode. "poster" is reserved
// for a future grid view — keep it here so when the cycle expands we
// don't need to touch this file's shape.
const META: Record<Density, ModeMeta> = {
  cozy: { Icon: Rows3, i18nKey: "cozy" },
  compact: { Icon: Rows4, i18nKey: "compact" },
  card: { Icon: LayoutGrid, i18nKey: "card" },
  poster: { Icon: LayoutGrid, i18nKey: "poster" },
};

// Cycle order must match `CYCLE_ORDER` in useDensity.ts. Used here ONLY
// to compute the tooltip's "next mode" label — the actual cycling logic
// lives in the hook so it's the single source of truth.
const CYCLE: Density[] = ["cozy", "compact", "card"];

// Single-button view-mode cycler. Click advances cozy → compact → card
// → cozy. Hidden on mobile (`md:inline-flex`) — the mobile path is
// always a card list and doesn't expose this control. Replaces the
// previous 2-button group; saves horizontal space in the top bar and
// is extensible (poster mode lands by adding "poster" to CYCLE).
export function DensityToggle() {
  const t = useTranslations("filters.density");
  const { density, cycle } = useDensity();
  const meta = META[density];
  const Icon = meta.Icon;
  const currentLabel = t(meta.i18nKey);
  const nextDensity =
    CYCLE[(CYCLE.indexOf(density) + 1) % CYCLE.length] ?? CYCLE[0];
  const nextLabel = t(META[nextDensity].i18nKey);
  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={t("buttonLabel")}
      title={t("next", { mode: nextLabel })}
      className="border-input bg-background hover:bg-accent/50 text-muted-foreground h-control-sm hidden items-center gap-2 rounded-md border px-2 text-xs transition-colors md:inline-flex"
    >
      <Icon className="size-4" aria-hidden />
      <span className="sr-only">{currentLabel}</span>
    </button>
  );
}
