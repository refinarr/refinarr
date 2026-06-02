"use client";
import { useTranslations } from "next-intl";
import { Image, LayoutGrid, Rows3, Rows4 } from "lucide-react";
import {
  useDensity,
  CYCLE_ORDER,
  type Density,
} from "@/client/hooks/ui/useDensity";

interface ModeMeta {
  Icon: typeof Rows3;
  i18nKey: "cozy" | "compact" | "card" | "poster";
}

// Visual + label metadata for each density mode.
const META: Record<Density, ModeMeta> = {
  cozy: { Icon: Rows3, i18nKey: "cozy" },
  compact: { Icon: Rows4, i18nKey: "compact" },
  card: { Icon: LayoutGrid, i18nKey: "card" },
  poster: { Icon: Image, i18nKey: "poster" },
};

// Single-button view-mode cycler. Click advances cozy → compact → card
// → poster → cozy. Hidden on mobile (`md:inline-flex`) — the mobile
// path is always a card list (or the poster grid when that density is
// active) and doesn't expose this control. Saves horizontal space in
// the top bar versus a multi-button group. CYCLE_ORDER is imported from
// the hook so the "next mode" tooltip can't drift from the real cycle.
export function DensityToggle() {
  const t = useTranslations("filters.density");
  const { density, cycle } = useDensity();
  const meta = META[density];
  const Icon = meta.Icon;
  const currentLabel = t(meta.i18nKey);
  const idx = CYCLE_ORDER.indexOf(density);
  const nextDensity =
    CYCLE_ORDER[idx === -1 ? 0 : (idx + 1) % CYCLE_ORDER.length];
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
