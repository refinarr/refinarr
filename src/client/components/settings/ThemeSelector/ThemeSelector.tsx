"use client";
import { useTranslations } from "next-intl";
import { Check, Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/client/hooks/ui/useTheme";
import { cn } from "@/client/lib/utils";
import type { Mode } from "@/client/lib/theme";
import type { BrandId } from "@/client/themes";

const MODES: Array<{
  id: Mode;
  labelKey: "modeLight" | "modeDark" | "modeSystem";
  icon: typeof Sun;
}> = [
  { id: "light", labelKey: "modeLight", icon: Sun },
  { id: "dark", labelKey: "modeDark", icon: Moon },
  { id: "system", labelKey: "modeSystem", icon: Monitor },
];

const BRAND_LABEL_KEYS: Record<
  BrandId,
  "brands.amber.label" | "brands.teal.label"
> = {
  amber: "brands.amber.label",
  teal: "brands.teal.label",
};

const BRAND_DESCRIPTION_KEYS: Record<
  BrandId,
  "brands.amber.description" | "brands.teal.description"
> = {
  amber: "brands.amber.description",
  teal: "brands.teal.description",
};

export function ThemeSelector() {
  const t = useTranslations("settings.appearance");
  const { brand: active, brands, mode, setBrand, setMode } = useTheme();

  return (
    <div className="space-y-4">
      <div
        role="radiogroup"
        aria-label={t("modeAriaLabel")}
        className="border-border inline-flex rounded-lg border p-1"
      >
        {MODES.map(({ id, labelKey, icon: Icon }) => {
          const selected = mode === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setMode(id)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                selected
                  ? "bg-brand text-foreground-on-brand"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              <span>{t(labelKey)}</span>
            </button>
          );
        })}
      </div>

      <div
        role="radiogroup"
        aria-label={t("ariaLabel")}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        {brands.map((b) => {
          const selected = active.id === b.id;
          return (
            <button
              key={b.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setBrand(b.id)}
              className={cn(
                "group relative flex flex-col gap-3 rounded-lg border p-3 text-left transition-colors",
                "hover:bg-muted/40",
                selected
                  ? "border-brand ring-brand/40 ring-2"
                  : "border-border",
              )}
            >
              <div className="border-border/60 flex h-16 w-full overflow-hidden rounded-md border">
                <div
                  className="relative flex-1"
                  style={{ backgroundColor: b.swatch.surfaceLight }}
                >
                  <span
                    className="absolute bottom-2 left-2 size-3 rounded-full"
                    style={{ backgroundColor: b.swatch.brand }}
                    aria-hidden
                  />
                </div>
                <div
                  className="relative flex-1"
                  style={{ backgroundColor: b.swatch.surfaceDark }}
                >
                  <span
                    className="absolute bottom-2 left-2 size-3 rounded-full"
                    style={{ backgroundColor: b.swatch.brand }}
                    aria-hidden
                  />
                </div>
                {selected && (
                  <span className="bg-brand text-foreground-on-brand absolute top-2 right-2 flex size-5 items-center justify-center rounded-full">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                )}
              </div>
              <div>
                <div className="text-sm font-medium">
                  {t(BRAND_LABEL_KEYS[b.id])}
                </div>
                <div className="text-muted-foreground text-xs">
                  {t(BRAND_DESCRIPTION_KEYS[b.id])}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
