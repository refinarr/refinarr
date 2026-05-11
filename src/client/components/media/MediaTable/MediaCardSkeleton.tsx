"use client";
import type { CSSProperties } from "react";

interface Props {
  index: number;
  // Pre-merged virt-mode positioning. pb-card-gap supplies the inter-
  // card spacing (gap utilities don't apply to absolute children).
  style: CSSProperties;
}

// Skeleton placeholder card rendered for indices past loaded data —
// keeps the mobile list filled while the next page is in flight.
export function MediaCardSkeleton({ index, style }: Props) {
  return (
    <li
      aria-hidden
      data-skeleton
      data-index={index}
      className="pb-card-gap"
      style={style}
    >
      <div className="bg-card h-card-min animate-pulse rounded-lg border" />
    </li>
  );
}
