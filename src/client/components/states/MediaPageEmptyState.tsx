"use client";
import { AllClearState } from "./AllClearState";
import { NoCfsPrompt } from "./NoCfsPrompt";
import { NoFilterMatchState } from "./NoFilterMatchState";

// One discriminated state instead of three booleans:
// - "no-cfs": no instance picked yet, or instance has no CF preferences
// - "filtered-empty": filters/q are active and produce zero rows
// - "all-clear": every flagged item is resolved (or none ever existed)
export type EmptyStateKind = "no-cfs" | "filtered-empty" | "all-clear";

interface Props {
  state: EmptyStateKind;
  onClear: () => void;
}

export function MediaPageEmptyState({ state, onClear }: Props) {
  if (state === "no-cfs") return <NoCfsPrompt />;
  if (state === "filtered-empty") return <NoFilterMatchState onClear={onClear} />;
  return <AllClearState />;
}
