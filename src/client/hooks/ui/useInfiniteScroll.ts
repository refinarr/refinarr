"use client";
import { useEffect, useRef } from "react";

// rootMargin extends the IntersectionObserver's "active area" below the
// viewport so the sentinel fires fetchNextPage *before* the user reaches
// the end of currently-loaded rows. Without this, a fast down-scroll
// hits the bottom of the loaded data before the next page request even
// starts — the user sees blank space for the duration of the network
// round-trip. 1200px ≈ 25 rows of head-start at cozy density, enough
// time for a typical server response on a LAN.
const PREFETCH_MARGIN_PX = 1200;

export function useInfiniteScroll(onLoadMore: () => void, hasMore: boolean) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) onLoadMore();
      },
      {
        threshold: 0,
        rootMargin: `0px 0px ${PREFETCH_MARGIN_PX}px 0px`,
      },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [onLoadMore, hasMore]);

  return sentinelRef;
}
