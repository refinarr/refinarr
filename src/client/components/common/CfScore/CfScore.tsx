type CfScoreVariant = "present" | "missing";

interface Props {
  name: string;
  score?: number;
  variant?: CfScoreVariant;
}

export function CfScore({ name, score, variant = "present" }: Props) {
  if (variant === "missing") {
    return (
      <span className="bg-destructive/10 text-destructive/80 inline-flex items-center rounded-sm px-1.5 py-0.5 text-xs line-through">
        {name}
      </span>
    );
  }

  const hasScore = score !== undefined;
  const positive = (score ?? 0) >= 0;
  return (
    <span className="bg-muted/40 inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs">
      <span className="text-foreground/80">{name}</span>
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
