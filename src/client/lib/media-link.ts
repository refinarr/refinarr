import { ARR_META } from "@/shared/arr-meta";
import type { ArrType } from "@/shared/types/models";

// Build a "find this item on the media list page" URL.
//
// Consumed by History rows + Dashboard Recent Activity. The landed
// page filters by `mediaId` (server-side exact match, bypassing every
// other filter), so the row is the sole result — no scroll, no fuzzy
// title match. `focus` keeps the highlight pulse on the row.
export function mediaFocusPath(input: {
  instanceType: ArrType;
  instanceId: number;
  mediaId: number;
}): string {
  const base = ARR_META[input.instanceType].libraryRoute;
  const params = new URLSearchParams({
    instanceId: String(input.instanceId),
    mediaId: String(input.mediaId),
    focus: String(input.mediaId),
  });
  return `${base}?${params.toString()}`;
}
