"use client";
import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { cn } from "@/client/lib/utils";
import { APP_THEMES, type AppTheme } from "@/app/providers";

interface Swatch {
  theme: AppTheme;
  surfaceClass: string;
  brandClass: string;
}

// Tailwind utility classes resolve to the tokens defined in
// `src/app/globals.css` `@theme { … }`. Edit colors there.
const SWATCHES: Swatch[] = [
  {
    theme: "dark-orange",
    surfaceClass: "bg-surface-dark",
    brandClass: "bg-brand-amber",
  },
  {
    theme: "dark-teal",
    surfaceClass: "bg-surface-dark",
    brandClass: "bg-brand-teal",
  },
  {
    theme: "light",
    surfaceClass: "bg-surface-light",
    brandClass: "bg-brand-amber",
  },
];

// next-themes resolves the active theme from localStorage on the client only;
// during SSR `theme` is undefined. Render the checkmark only after hydration
// so the server and first client paint stay identical.
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export function AppearanceSelector() {
  const t = useTranslations("settings.appearance");
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  return (
    <div
      role="radiogroup"
      aria-label={t("ariaLabel")}
      className="grid grid-cols-1 gap-3 sm:grid-cols-3"
    >
      {SWATCHES.map(({ theme: name, surfaceClass, brandClass }) => {
        const selected = mounted && theme === name;
        return (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setTheme(name)}
            className={cn(
              "group relative flex flex-col gap-3 rounded-lg border p-3 text-left transition-colors",
              "hover:bg-muted/40",
              selected ? "border-brand ring-2 ring-brand/40" : "border-border",
            )}
          >
            <div
              className={cn(
                "relative h-16 w-full overflow-hidden rounded-md border border-border/60",
                surfaceClass,
              )}
            >
              <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
                <span
                  className={cn("h-3 w-3 rounded-full", brandClass)}
                  aria-hidden
                />
                <span
                  className={cn(
                    "h-1.5 w-10 rounded-full opacity-40",
                    brandClass,
                  )}
                  aria-hidden
                />
              </div>
              {selected && (
                <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-foreground-on-brand">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
              )}
            </div>
            <span className="text-sm font-medium">
              {t(`themes.${name}` as const)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Re-exported for tests + anywhere else that needs the canonical list.
export { APP_THEMES };
