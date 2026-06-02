import { cn } from "@/client/lib/utils";

type CfScoreVariant = "present" | "missing";

interface Props {
  name: string;
  score?: number;
  variant?: CfScoreVariant;
  // Dense (single-line) contexts like the media card: let the chip shrink
  // and ellipsize a long name so a row of chips stays on one line instead
  // of forcing the card taller. The score stays fully visible.
  truncate?: boolean;
}

export function CfScore({ name, score, variant = "present", truncate }: Props) {
  if (variant === "missing") {
    return (
      <span
        className={cn(
          "bg-destructive/10 text-destructive/80 inline-flex items-center rounded-sm px-1.5 py-0.5 text-xs line-through",
          truncate && "min-w-0",
        )}
      >
        <span className={cn(truncate && "truncate")}>{name}</span>
      </span>
    );
  }

  const hasScore = score !== undefined;
  const positive = (score ?? 0) >= 0;
  return (
    <span
      className={cn(
        "bg-muted/40 inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs",
        truncate && "min-w-0",
      )}
    >
      <span className={cn("text-foreground/80", truncate && "truncate")}>
        {name}
      </span>
      {hasScore && (
        <span
          className={
            positive ? "text-ok tabular-nums" : "text-critical tabular-nums"
          }
        >
          {score! > 0 ? "+" : ""}
          {score}
        </span>
      )}
    </span>
  );
}
