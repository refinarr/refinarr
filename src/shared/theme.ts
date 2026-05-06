// Hex mirror of the brand palette held in `src/client/themes/<id>.ts`.
//
// For all in-app styling, prefer the Tailwind utilities (`bg-brand`,
// `text-foreground-on-brand`, `bg-critical`, …) which read from CSS
// vars applied at runtime by `src/client/lib/theme.ts` and follow theme
// switches automatically.
//
// This file exists only because Next.js metadata (PWA manifest, viewport
// `themeColor`, OG images) is serialised at SSR / build time and cannot
// read CSS custom properties.
//
// If you change a theme's `--background` oklch in `src/client/themes/`,
// update the matching hex below to keep the metadata in sync.

export const SURFACE_DARK = "#0a0a0a";
export const SURFACE_LIGHT = "#ffffff";
