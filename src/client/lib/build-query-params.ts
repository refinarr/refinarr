// Append filter-shaped values to a URLSearchParams. Skips empty/falsy
// entries (undefined, null, "", false) so toggle/checkbox filters that are
// off don't pollute the URL. Arrays serialise as comma-joined when non-empty.
export function appendFilterParams(
  params: URLSearchParams,
  filters: Record<string, unknown>,
): void {
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null || v === "" || v === false) continue;
    if (Array.isArray(v)) {
      if (v.length > 0) params.set(k, v.join(","));
    } else {
      params.set(k, String(v));
    }
  }
}
