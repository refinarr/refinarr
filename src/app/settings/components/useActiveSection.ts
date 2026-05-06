"use client";
import { useEffect, useState } from "react";

interface Options {
  ids: string[];
  // Fraction of the viewport from the top where a section is considered
  // "active" once its top crosses the line. Default 0.33 = 1/3 down from
  // the top of the viewport — feels natural while scrolling.
  threshold?: number;
}

// Tracks which section id is currently in the viewport's focus band.
// Used by SettingsRail / SettingsPicker to keep the active highlight in
// sync as the user scrolls. Returns the topmost-intersecting id.
//
// IntersectionObserver root is `null` (viewport). The AppShell's <main>
// fills the viewport via `flex-1`, so the viewport approximates the
// scrolling area for our purposes.
export function useActiveSection({ ids, threshold = 0.33 }: Options): string {
  const [active, setActive] = useState<string>(ids[0] ?? "");

  useEffect(() => {
    if (ids.length === 0 || typeof window === "undefined") return;
    const margin = `-${Math.round(threshold * 100)}% 0px -${Math.round(
      (1 - threshold) * 100,
    )}% 0px`;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: margin, threshold: 0 },
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [ids, threshold]);

  return active;
}
