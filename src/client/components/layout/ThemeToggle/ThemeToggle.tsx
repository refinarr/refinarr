"use client";
import { useTranslations } from "next-intl";
import { Palette, Check, Sun, Moon, Monitor } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/client/components/ui/dropdown-menu";
import { useTheme } from "@/client/hooks/ui/useTheme";
import { cn } from "@/client/lib/utils";
import type { Mode } from "@/client/lib/theme";

interface Props {
  className?: string;
}

const TRIGGER_CLASS =
  "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

const MODES: Array<{
  id: Mode;
  labelKey: "modeLight" | "modeDark" | "modeSystem";
  icon: typeof Sun;
}> = [
  { id: "light", labelKey: "modeLight", icon: Sun },
  { id: "dark", labelKey: "modeDark", icon: Moon },
  { id: "system", labelKey: "modeSystem", icon: Monitor },
];

export function ThemeToggle({ className }: Props) {
  const t = useTranslations("settings.appearance");
  const { brand, brands, mode, setBrand, setMode } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(TRIGGER_CLASS, className)}
        aria-label={t("toggleAriaLabel")}
      >
        <Palette className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {MODES.map(({ id, labelKey, icon: Icon }) => (
          <DropdownMenuItem
            key={id}
            onClick={() => setMode(id)}
            className="flex items-center gap-2"
          >
            <Icon className="size-4" />
            <span className="flex-1">{t(labelKey)}</span>
            {mode === id && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        {brands.map((b) => (
          <DropdownMenuItem
            key={b.id}
            onClick={() => setBrand(b.id)}
            className="flex items-center gap-2"
          >
            <span
              className="ring-border size-4 rounded-full ring-1"
              style={{ backgroundColor: b.swatch.brand }}
              aria-hidden
            />
            <span className="flex-1">
              {t(`brands.${b.id}` as `brands.${string}`)}
            </span>
            {brand.id === b.id && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
