import type { Severity } from "./types/models";

// Maps a profile custom-format score to a severity bucket. Pure — used by
// both the client (table dot, chip color) and the server (severity column
// funnel). `target` is the quality profile's cutoff score; when it is
// undefined or <= 0 the item has no meaningful cutoff and falls back to
// the coarse 0.3/0.6/0.85 buckets.
export function getSeverity(
  score: number,
  target: number | undefined,
  hasFile = true,
): Severity {
  if (!hasFile) return "missing";
  if (target !== undefined && target > 0) {
    if (score < 0) return "critical";
    if (score < target * 0.33) return "low";
    if (score < target * 0.75) return "warning";
    return "ok";
  }
  if (score < 0.3) return "critical";
  if (score < 0.6) return "low";
  if (score < 0.85) return "warning";
  return "ok";
}
