import type { ArrType } from "./types/models";

// Default arr type used when a new-instance form starts blank. Radarr
// happens to be alphabetically first; the choice is cosmetic and the user
// changes it before saving. Centralized so the form, server seeding, etc.
// all agree on the same default without duplicating the literal.
export const DEFAULT_ARR_TYPE: ArrType = "radarr";

// Canonical list-page route per arr type. The home of "movies in this
// instance" is /movies for radarr and /shows for sonarr; multiple UI
// surfaces (dashboard summary card, command palette, sidebar nav) link
// to it. Lives here so adding Lidarr/Whisparr is one entry instead of
// chasing the literal across components.
export const ARR_LIBRARY_ROUTE: Record<ArrType, string> = {
  radarr: "/movies",
  sonarr: "/shows",
};

// Stable iteration order over every supported arr type. Derived from the
// route registry so adding Lidarr/Whisparr there is enough — no separate
// list to keep in sync.
export const ALL_ARR_TYPES = Object.keys(ARR_LIBRARY_ROUTE) as ArrType[];

// Type-guard for narrowing string inputs (Select onValueChange, URL params,
// etc.) to ArrType without an unchecked `as ArrType` cast.
export const isArrType = (v: string): v is ArrType =>
  (ALL_ARR_TYPES as readonly string[]).includes(v);
