import type { CustomFormat, MediaItem } from "./types/models";

// Profile is the only scoring mode. These helpers expose the profile-mode
// view of a media item: its raw custom-format score (compared to the
// quality profile's cutoff) and the unwanted (negative-score) formats
// present on the file.

export const scoreForItem = (item: MediaItem): number => item.customFormatScore;

export const issuesForItem = (item: MediaItem): CustomFormat[] =>
  item.unwantedFormats;
