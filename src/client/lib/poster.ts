import type { ArrType } from "@/shared/types/models";

// Per-arr poster proxy endpoint. A Record (not a switch) so a new arr
// type fails to compile until its route is registered here — matching
// the type-keyed dispatch used across the server (mediaServiceFor, etc.).
const POSTER_ROUTE: Record<ArrType, string> = {
  radarr: "/api/radarr/movies/poster",
  sonarr: "/api/sonarr/series/poster",
};

// Same-origin URL for an item's poster, streamed through the auth-gated
// proxy (the instance API key never reaches the browser; CSP stays
// locked). The <img> request carries the session cookie automatically.
export function posterUrl(
  arrType: ArrType,
  instanceId: number,
  mediaId: number,
): string {
  return `${POSTER_ROUTE[arrType]}?instanceId=${instanceId}&mediaId=${mediaId}`;
}
