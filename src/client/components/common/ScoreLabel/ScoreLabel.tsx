interface Props {
  score: number;
  minProfileScore?: number;
}

export function ScoreLabel({ score, minProfileScore }: Props) {
  if (minProfileScore !== undefined) {
    return (
      <span className="text-muted-foreground text-sm whitespace-nowrap tabular-nums">
        {score} / {minProfileScore}
      </span>
    );
  }
  return (
    <span className="text-muted-foreground text-sm tabular-nums">
      {Math.round(score * 100)}%
    </span>
  );
}
