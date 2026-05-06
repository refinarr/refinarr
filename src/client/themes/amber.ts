import { DARK_SURFACE_VARS, LIGHT_SURFACE_VARS } from "./_surface-vars";
import type { Brand } from "./types";

const AMBER_BRAND = "oklch(0.78 0.16 75)";
const AMBER_FOREGROUND = "oklch(0.145 0 0)";

export const amber: Brand = {
  id: "amber",
  name: "settings.appearance.brands.amber.label",
  description: "settings.appearance.brands.amber.description",
  swatch: {
    brand: AMBER_BRAND,
    surfaceLight: "oklch(1 0 0)",
    surfaceDark: "oklch(0.145 0 0)",
  },
  cssVars: {
    light: {
      ...LIGHT_SURFACE_VARS,
      "--brand": AMBER_BRAND,
      "--foreground-on-brand": AMBER_FOREGROUND,
      "--primary": AMBER_BRAND,
      "--primary-foreground": AMBER_FOREGROUND,
      "--ring": AMBER_BRAND,
      "--sidebar-primary": AMBER_BRAND,
      "--sidebar-primary-foreground": AMBER_FOREGROUND,
    },
    dark: {
      ...DARK_SURFACE_VARS,
      "--brand": AMBER_BRAND,
      "--foreground-on-brand": AMBER_FOREGROUND,
      "--primary": AMBER_BRAND,
      "--primary-foreground": AMBER_FOREGROUND,
      "--ring": AMBER_BRAND,
      "--sidebar-primary": AMBER_BRAND,
      "--sidebar-primary-foreground": AMBER_FOREGROUND,
    },
  },
};
