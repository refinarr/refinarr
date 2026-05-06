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
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) onChange(visible[0].target.id);
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
