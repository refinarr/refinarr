"use client";
import { useEffect } from "react";

interface Options {
  ids: string[];
  onChange: (id: string) => void;
  // Fraction of the scroll container from the top that defines the
  // "active" band. Default 0.33 → a section is active when any part of
  // it is in the top third of the container. Using a band (not a
  // 0-height line) ensures short last sections still register — they
  // could otherwise never reach a 33%-line if the page can't scroll
  // further.
  threshold?: number;
}

// Calls `onChange` with the id of the topmost section currently
// intersecting the scroll container's focus band.
//
// Roots to AppShell's <main> (the actual scroll container after the
// html/body overflow lock), falling back to the viewport if main isn't
// in the DOM yet (tests / SSR).
//
// IntersectionObserver only emits entries whose state CHANGED since
// the last callback — never a full snapshot. We maintain `current`
// across callbacks so when `b` enters while `a` is still intersecting,
// `a` (the topmost) wins instead of being clobbered by the partial
// batch that only contains `b`.
//
// Callers own the active-id state. They can suppress feedback during
// programmatic scroll (e.g. click-driven smooth-scroll) by gating the
// onChange handler — no internal lock here.
export function useActiveSection({
  ids,
  onChange,
  threshold = 0.33,
}: Options): void {
  useEffect(() => {
    if (ids.length === 0 || typeof window === "undefined") return;
    const margin = `0px 0px -${Math.round((1 - threshold) * 100)}% 0px`;
    const root = document.getElementById("main");
    const current = new Map<string, number>(); // id → boundingClientRect.top
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).id;
          if (e.isIntersecting) {
            current.set(id, e.boundingClientRect.top);
          } else {
            current.delete(id);
          }
        }
        if (current.size === 0) return;
        let bestId: string | null = null;
        let bestTop = Infinity;
        for (const [id, top] of current) {
          if (top < bestTop) {
            bestId = id;
            bestTop = top;
          }
        }
        if (bestId) onChange(bestId);
      },
      { root, rootMargin: margin, threshold: 0 },
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [ids, onChange, threshold]);
}
