import type { CustomFormat, FlaggedMedia, ScoringMode } from "./types/models";

// Centralized dispatch tables for the two scoring modes. Replaces the
// scattered `mode === "profile" ? a : b` ternaries and matches the
// type-keyed registry pattern used elsewhere (mediaServiceFor,
// ArrClientFactory).
//
// Adding a third scoring mode means dropping a third entry in each map;
// every consumer picks it up automatically.

// The score field a flagged item exposes for the active mode. Profile mode
// uses the *arr's customFormatScore (compared to the profile's cutoff);
// manual mode uses cfScore (CF-coverage 0..1).
export const SCORE_FOR: Record<ScoringMode, (item: FlaggedMedia) => number> = {
  profile: (item) => item.customFormatScore,
  manual: (item) => item.cfScore,
};

// The "things wrong with this item" list for the active mode. Profile mode
// surfaces unwanted (negative-score) formats present on the file; manual
// mode surfaces wanted formats missing from the file.
export const ISSUES_FOR: Record<
  ScoringMode,
  (item: FlaggedMedia) => CustomFormat[]
> = {
  profile: (item) => item.unwantedFormats,
  manual: (item) => item.missingFormats,
};

// i18n key suffix under `<page>.columns.{key}` for the issues column
// header. Profile mode shows "Penalties"; manual mode shows "Missing".
export const ISSUES_HEADER_KEY: Record<ScoringMode, "penalties" | "missing"> = {
  profile: "penalties",
  manual: "missing",
};

// Type-guard helpers for the conditional-gate sites where a Record
// dispatch doesn't fit (e.g. "if mode is X AND another condition, do Y").
// Using these instead of `mode === "profile"` keeps the literal
// confined to this file — every other file imports via the helper.
export const isProfileMode = (m: ScoringMode): m is "profile" =>
  m === "profile";
export const isManualMode = (m: ScoringMode): m is "manual" => m === "manual";

// Default scoring mode used when an instance lookup misses or when the
// server creates an instance row without an explicit override. Profile is
// the safer default — it derives the target from the *arr's quality
// profile cutoff and works without any per-instance CF preferences.
export const DEFAULT_SCORING_MODE: ScoringMode = "profile";

// Stable iteration order over every supported scoring mode. Useful for UI
// surfaces that need to render an option per mode (e.g. <SelectItem>).
// Kept in sync with the Record<ScoringMode, ...> registries above; if
// TypeScript starts complaining about exhaustiveness on those, this list
// needs a new entry too.
export const ALL_SCORING_MODES = Object.keys(SCORE_FOR) as ScoringMode[];
