import type { LucideIcon } from "lucide-react";
import { Film, Tv2 } from "lucide-react";
import type { ArrType } from "@/shared/types/models";

// Client-side per-arr UI choices. Lives next to React (not in `shared`)
// because icons are component refs that pull from lucide-react and
// shouldn't cross the client/server boundary.
//
// The single source of truth for icon + nav label + command-palette
// heading per arr type. Both `NavContent.tsx` and `CommandPalette.tsx`
// iterate this map — adding Lidarr / Whisparr means adding one row here
// (plus an `ARR_META` row in `src/shared/arr-meta.ts`), not editing
// each consumer file. The existing per-key i18n entries
// (`nav.movies`, `commandPalette.groups.radarrInstance`, …) live in
// `messages/en.json` as usual.
export interface ArrUi {
  // i18n key under `nav.*` for the sidebar label (e.g. "movies" → "Movies")
  navLabelKey: string;
  // i18n key under `commandPalette.groups.*` for the per-instance group
  // heading (e.g. "Open Radarr instance")
  commandPaletteHeadingKey: string;
  Icon: LucideIcon;
}

// `as const satisfies` preserves the literal key types so consumers'
// typed `useTranslations` calls don't need a string cast.
export const ARR_UI = {
  radarr: {
    navLabelKey: "movies",
    commandPaletteHeadingKey: "groups.radarrInstance",
    Icon: Film,
  },
  sonarr: {
    navLabelKey: "shows",
    commandPaletteHeadingKey: "groups.sonarrInstance",
    Icon: Tv2,
  },
} as const satisfies Record<ArrType, ArrUi>;
