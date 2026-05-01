interface Props {
  score: number;
  minProfileScore?: number;
}

export function ScoreLabel({ score, minProfileScore }: Props) {
  if (minProfileScore !== undefined) {
    return (
      <span className="tabular-nums text-sm text-muted-foreground whitespace-nowrap">
        {score} / {minProfileScore}
      </span>
    );
  }
  return (
    <span className="tabular-nums text-sm text-muted-foreground">
      {Math.round(score * 100)}%
    </span>
  );
}
