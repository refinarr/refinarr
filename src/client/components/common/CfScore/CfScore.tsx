type CfScoreVariant = "present" | "missing";

interface Props {
  name: string;
  score?: number;
  variant?: CfScoreVariant;
}

export function CfScore({ name, score, variant = "present" }: Props) {
  if (variant === "missing") {
    return (
      <span className="inline-flex items-center rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive/80 line-through">
        {name}
      </span>
    );
  }

  const hasScore = score !== undefined;
  const positive = (score ?? 0) >= 0;
  return (
    <span className="inline-flex items-center gap-1 rounded bg-muted/40 px-1.5 py-0.5 text-xs">
      <span className="text-foreground/80">{name}</span>
      {hasScore && (
        <span
          className={
            positive
              ? "text-green-400 tabular-nums"
              : "text-destructive tabular-nums"
          }
        >
          {score! > 0 ? "+" : ""}
          {score}
        </span>
      )}
    </span>
  );
}
