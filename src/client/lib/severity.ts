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

export const severityLabel: Record<Severity, string> = {
  critical: "Critical",
  low: "Low",
  warning: "Warning",
  ok: "OK",
  missing: "No file",
};
