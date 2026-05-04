// Hex mirror of the brand palette in src/app/globals.css.
//
// For all in-app styling, prefer the Tailwind utilities (`bg-brand`,
// `bg-brand-amber`, `bg-surface-dark`, `fill-foreground-on-brand`, ...)
// which read from globals.css at runtime and follow theme switches.
//
// This file exists only because Next.js metadata (PWA manifest, viewport
// `themeColor`, OG images) is serialised at SSR / build time and cannot
// read CSS custom properties.
//
// If you change colors here, also update the matching tokens in
// `src/app/globals.css` `@theme { … }` (and vice versa).

export const BRAND_AMBER = "#f59e0b";
export const BRAND_TEAL = "#14b8a6";
export const SURFACE_DARK = "#0a0a0a";
export const SURFACE_LIGHT = "#ffffff";
