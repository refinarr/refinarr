import { isProfileMode } from "./scoring-mode";
import type { ScoringMode, Severity } from "./types/models";

// Maps a score (manual: 0..1; profile: raw integer) to a severity bucket.
// Pure — used by both the client (table dot, chip color) and the server
// (severity column funnel). `target` is the cutoff for profile mode.
export function getSeverity(
  score: number,
  target: number | undefined,
  mode: ScoringMode,
  hasFile = true,
): Severity {
  if (!hasFile) return "missing";
  if (isProfileMode(mode) && target !== undefined && target > 0) {
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
