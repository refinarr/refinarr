import {
  severityClass,
  severityLabel,
  type Severity,
} from "@/client/lib/severity";

interface Props {
  severity: Severity;
  className?: string;
}

export function SeverityDot({ severity, className }: Props) {
  return (
    <span
      role="img"
      aria-label={severityLabel[severity]}
      title={severityLabel[severity]}
      className={`inline-block size-2.5 rounded-full ${severityClass[severity]} ${className ?? ""}`}
    />
  );
}
