"use client";
import { AllClearState } from "./AllClearState";
import { NoCfsPrompt } from "./NoCfsPrompt";
import { NoFilterMatchState } from "./NoFilterMatchState";

interface Props {
  hasInstance: boolean;
  noCfsConfigured: boolean;
  hasActiveFilters: boolean;
  onClear: () => void;
}

export function MediaPageEmptyState({
  hasInstance,
  noCfsConfigured,
  hasActiveFilters,
  onClear,
}: Props) {
  if (!hasInstance || noCfsConfigured) return <NoCfsPrompt />;
  if (hasActiveFilters) return <NoFilterMatchState onClear={onClear} />;
  return <AllClearState />;
}
