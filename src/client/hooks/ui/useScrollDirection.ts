"use client";
import { useEffect, useState } from "react";

// Return the active scroll direction inside AppShell's <main> element.
// `null` until the user has moved more than `threshold` pixels — small
// jitter (rubber-band, momentum drift) doesn't flip the direction.
//
// Drives mobile patterns where chrome auto-hides on scroll-down and
// returns on scroll-up (qui's MobileScrollProvider behaviour, distilled
// into a hook because refinarr's AppShell guarantees a single named
// scroll container so we don't need to plumb the element through a
// context).
//
// RAF-throttled — every native scroll event schedules at most one
// handler per frame, so even a flick gesture runs at 60Hz max.
export function useScrollDirection(threshold = 10): "up" | "down" | null {
  const [direction, setDirection] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    const main = document.getElementById("main");
    if (!main) return;

    let lastY = main.scrollTop;
    let ticking = false;

    const update = () => {
      const y = main.scrollTop;
      if (Math.abs(y - lastY) < threshold) {
        ticking = false;
        return;
      }
      setDirection(y > lastY ? "down" : "up");
      lastY = y > 0 ? y : 0;
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    };

    main.addEventListener("scroll", onScroll, { passive: true });
    return () => main.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return direction;
}
