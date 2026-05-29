"use client";
import { useEffect, useState } from "react";

// Return the active scroll direction inside the page's vertical
// scroller. `null` until the user has moved more than `threshold` pixels
// — small jitter (rubber-band, momentum drift) doesn't flip the
// direction.
//
// How it finds the scroller without races: rather than `querySelector`
// at effect mount (which breaks if the scroll container remounts — e.g.
// instance switch, density toggle on desktop, drawer transitions), we
// attach a capture-phase scroll listener on `window`. Scroll events
// don't bubble but they DO travel through the capture phase, so the
// listener sees every scroll on every element. We then filter by the
// `data-scroll-root` attribute or `#main` element so dropdowns, dialog
// scrollers, and sheets don't move the page chrome.
//
// Drives mobile patterns where chrome auto-hides on scroll-down and
// returns on scroll-up (qui's MobileScrollProvider behaviour).
//
// RAF-throttled — every native scroll event schedules at most one
// handler per frame, so even a flick gesture runs at 60Hz max.
export function useScrollDirection(threshold = 10): "up" | "down" | null {
  const [direction, setDirection] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let lastY = readScrollerY();
    let ticking = false;
    let activeTarget: HTMLElement | null = null;

    const update = () => {
      const y = activeTarget ? activeTarget.scrollTop : readScrollerY();
      if (Math.abs(y - lastY) < threshold) {
        ticking = false;
        return;
      }
      setDirection(y > lastY ? "down" : "up");
      lastY = y > 0 ? y : 0;
      ticking = false;
    };

    const onScroll = (event: Event) => {
      const target = event.target;
      // event.target can be Document for window-level scrolls — only
      // accept HTMLElements we recognise as the page scroller.
      if (!(target instanceof HTMLElement)) return;
      if (!isPageScroller(target)) return;
      activeTarget = target;
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    };

    // Capture phase so we catch scroll events from any element on the
    // page (scroll events don't bubble, but they do capture).
    window.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
    });
    return () => {
      window.removeEventListener("scroll", onScroll, {
        capture: true,
      } as EventListenerOptions);
    };
  }, [threshold]);

  return direction;
}

function isPageScroller(el: HTMLElement): boolean {
  if (el.hasAttribute("data-scroll-root")) return true;
  if (el.id === "main") return true;
  return false;
}

function readScrollerY(): number {
  if (typeof document === "undefined") return 0;
  const marked = document.querySelector<HTMLElement>(
    "#main [data-scroll-root]",
  );
  if (marked) return marked.scrollTop;
  const main = document.getElementById("main");
  return main?.scrollTop ?? 0;
}
