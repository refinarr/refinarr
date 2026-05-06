import { isProfileMode } from "@/shared/scoring-mode";
import type { ScoringMode, Severity } from "@/shared/types/models";

export type { Severity };

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

export const severityClass: Record<Severity, string> = {
  critical: "bg-critical",
  low: "bg-warning",
  warning: "bg-warning",
  ok: "bg-ok",
  missing: "bg-neutral-soft",
};

export const severityLabel: Record<Severity, string> = {
  critical: "Critical",
  low: "Low",
  warning: "Warning",
  ok: "OK",
  missing: "No file",
};
