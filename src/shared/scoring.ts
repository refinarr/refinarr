export function isBelowProfileScore(
  currentScore: number,
  minScore: number,
): boolean {
  if (minScore === 0) return false;
  return currentScore < minScore;
}

export function scoreProfileCoverage(
  currentScore: number,
  minScore: number,
): number {
  if (minScore === 0) return 1;
  return Math.max(0, Math.min(currentScore / minScore, 1));
}
