import type { Severity } from "@/shared/types/models";

export { getSeverity } from "@/shared/severity";
export type { Severity };

export const severityClass: Record<Severity, string> = {
  critical: "bg-critical",
  low: "bg-warning",
  warning: "bg-warning",
  ok: "bg-ok",
  missing: "bg-neutral-soft",
};

// Text-color counterpart of severityClass — color-keys the prominent
// card score by severity (a 0/35 critical reads red, an at-cutoff item
// green, etc.).
export const severityTextClass: Record<Severity, string> = {
  critical: "text-critical",
  low: "text-warning",
  warning: "text-warning",
  ok: "text-ok",
  missing: "text-muted-foreground",
};

export const severityLabel: Record<Severity, string> = {
  critical: "Critical",
  low: "Low",
  warning: "Warning",
  ok: "OK",
  missing: "No file",
};
