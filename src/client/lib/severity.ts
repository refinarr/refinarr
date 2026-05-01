import type { ScoringMode } from "@/shared/types/models";

export type Severity = "critical" | "low" | "warning" | "ok";

export function getSeverity(
  score: number,
  target: number | undefined,
  mode: ScoringMode
): Severity {
  if (mode === "profile" && target !== undefined && target > 0) {
    if (score < 0) return "critical";
    if (score < target * 0.5) return "low";
    if (score < target * 0.8) return "warning";
    return "ok";
  }
  if (score < 0.3) return "critical";
  if (score < 0.6) return "low";
  if (score < 0.85) return "warning";
  return "ok";
}

export const severityClass: Record<Severity, string> = {
  critical: "bg-red-500",
  low: "bg-orange-500",
  warning: "bg-yellow-500",
  ok: "bg-green-500",
};

export const severityLabel: Record<Severity, string> = {
  critical: "Critical",
  low: "Low",
  warning: "Warning",
  ok: "OK",
};
