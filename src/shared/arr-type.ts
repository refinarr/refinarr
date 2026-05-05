import type { ArrType } from "./types/models";

// Default arr type used when a new-instance form starts blank. Radarr
// happens to be alphabetically first; the choice is cosmetic and the user
// changes it before saving. Centralized so the form, server seeding, etc.
// all agree on the same default without duplicating the literal.
export const DEFAULT_ARR_TYPE: ArrType = "radarr";

// Stable iteration order over every supported arr type. Keep in sync
// with the Record<ArrType, ...> registries scattered across the codebase
// (mediaServiceFor, ArrClientFactory, PER_TYPE in InstanceSummaryCard,
// ARR_GROUPS in CommandPalette, TYPE_LABELS in AddInstanceDialog).
// TypeScript catches missing entries on those Records; this list mainly
// helps UI iteration where Object.keys() loses the typed key.
export const ALL_ARR_TYPES: readonly ArrType[] = ["radarr", "sonarr"] as const;
