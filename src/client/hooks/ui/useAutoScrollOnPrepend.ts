"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

interface Options<T> {
  containerRef: RefObject<HTMLElement | null>;
  items: readonly T[];
  enabled: boolean;
}

interface Result {
  paused: boolean;
  resume: () => void;
}

const RESUME_THRESHOLD_PX = 16;

/**
 * Newest-first live-tail scroll helper.
 *
 *   • When `enabled` and not paused: snap scrollTop to 0 whenever new
 *     items prepend, so the freshest entry stays visible (`tail -f` feel).
 *   • When paused: preserve the viewed row by adding the prepended
 *     content's height to scrollTop. Without this compensation, content
 *     grows above the viewport and the user's investigation row drifts
 *     down on every SSE push — disorienting while reading a stack trace.
 *
 * Pause toggles automatically when the user scrolls past
 * `RESUME_THRESHOLD_PX`. Calling `resume()` snaps back to the top.
 */
export function useAutoScrollOnPrepend<T>({
  containerRef,
  items,
  enabled,
}: Options<T>): Result {
  const [paused, setPaused] = useState(false);
  const prevLength = useRef(items.length);
  const prevScrollHeight = useRef(0);

  useEffect(() => {
    const el = containerRef.current;
    const grew = items.length > prevLength.current;
    prevLength.current = items.length;
    if (!el) return;
    const heightBefore = prevScrollHeight.current;
    const heightAfter = el.scrollHeight;
    prevScrollHeight.current = heightAfter;
    if (!grew || !enabled) return;
    if (paused) {
      // Preserve the visible row: shift scrollTop by however much the
      // content grew above the viewport. `heightBefore === 0` on the
      // first effect run — skip the shift then so the user isn't
      // teleported on initial mount.
      if (heightBefore > 0) {
        const delta = heightAfter - heightBefore;
        if (delta > 0) el.scrollTop += delta;
      }
      return;
    }
    el.scrollTop = 0;
  }, [items, enabled, paused, containerRef]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;
    const onScroll = () => {
      if (el.scrollTop > RESUME_THRESHOLD_PX) setPaused(true);
      else setPaused(false);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [containerRef, enabled]);

  const resume = useCallback(() => {
    setPaused(false);
    const el = containerRef.current;
    if (el) el.scrollTop = 0;
  }, [containerRef]);

  return { paused, resume };
}
