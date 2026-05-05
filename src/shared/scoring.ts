import type { CustomFormat } from "@/shared/types/models";

export function isMissingWantedFormats(
  itemCfs: CustomFormat[],
  wantedIds: number[],
): boolean {
  if (wantedIds.length === 0) return false;
  const present = new Set(itemCfs.map((cf) => cf.id));
  return wantedIds.some((id) => !present.has(id));
}

export function getMissingFormats(
  itemCfs: CustomFormat[],
  wantedCfs: CustomFormat[],
): CustomFormat[] {
  const present = new Set(itemCfs.map((cf) => cf.id));
  return wantedCfs.filter((cf) => !present.has(cf.id));
}

export function scoreCfCoverage(
  itemCfs: CustomFormat[],
  wantedIds: number[],
): number {
  if (wantedIds.length === 0) return 1;
  const present = new Set(itemCfs.map((cf) => cf.id));
  const matched = wantedIds.filter((id) => present.has(id)).length;
  return matched / wantedIds.length;
}

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
