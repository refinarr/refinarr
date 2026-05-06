import { DARK_SURFACE_VARS, LIGHT_SURFACE_VARS } from "./_surface-vars";
import type { Brand } from "./types";

const TEAL_BRAND = "oklch(0.74 0.13 180)";
const TEAL_FOREGROUND = "oklch(0.145 0 0)";

export const teal: Brand = {
  id: "teal",
  name: "settings.appearance.brands.teal.label",
  description: "settings.appearance.brands.teal.description",
  swatch: {
    brand: TEAL_BRAND,
    surfaceLight: "oklch(1 0 0)",
    surfaceDark: "oklch(0.145 0 0)",
  },
  cssVars: {
    light: {
      ...LIGHT_SURFACE_VARS,
      "--brand": TEAL_BRAND,
      "--foreground-on-brand": TEAL_FOREGROUND,
      "--primary": TEAL_BRAND,
      "--primary-foreground": TEAL_FOREGROUND,
      "--ring": TEAL_BRAND,
      "--sidebar-primary": TEAL_BRAND,
      "--sidebar-primary-foreground": TEAL_FOREGROUND,
    },
    dark: {
      ...DARK_SURFACE_VARS,
      "--brand": TEAL_BRAND,
      "--foreground-on-brand": TEAL_FOREGROUND,
      "--primary": TEAL_BRAND,
      "--primary-foreground": TEAL_FOREGROUND,
      "--ring": TEAL_BRAND,
      "--sidebar-primary": TEAL_BRAND,
      "--sidebar-primary-foreground": TEAL_FOREGROUND,
    },
  },
};
