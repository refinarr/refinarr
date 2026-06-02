"use client";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";

// Broadcast so only ONE card stays open at a time — opening a card tells
// every other instance to close. Mirrors the CustomEvent pattern used by
// useDensity.
const OPEN_EVENT = "rfn:swipe-open";

// Pixels of travel before the gesture commits to an axis. Below this we
// don't know intent yet; once past it, a mostly-vertical move yields to
// list scrolling and a mostly-horizontal move becomes a reveal drag.
const AXIS_DEADZONE_PX = 6;

interface Options {
  // Swipe is mobile-only and must yield while bulk-selection is active;
  // the caller computes this. When false the hook is inert and forces
  // the card closed.
  enabled: boolean;
  // Total reveal width in px (sum of the action buttons behind the card).
  revealWidth: number;
  // Fraction of revealWidth past which release snaps open (else closed).
  threshold?: number;
}

interface Result {
  // Current px revealed (0 = closed, revealWidth = fully open). The card
  // content is translated left by this amount.
  offset: number;
  isOpen: boolean;
  // True only mid-drag — the caller drops the slide transition so the
  // card tracks the finger 1:1, then restores it for the snap.
  isDragging: boolean;
  close: () => void;
  // True when the last pointer interaction was a horizontal drag. The
  // caller checks (and resets) this in onClick so a swipe doesn't also
  // fire the row's tap handler (open drawer).
  wasDragRef: MutableRefObject<boolean>;
  surfaceProps: {
    onPointerDown: (e: ReactPointerEvent) => void;
    onPointerMove: (e: ReactPointerEvent) => void;
    onPointerUp: (e: ReactPointerEvent) => void;
    onPointerCancel: (e: ReactPointerEvent) => void;
  };
}

// Pointer-driven swipe-to-reveal for a single row. Axis-locked (vertical
// scroll wins), pointer-captured once horizontal intent commits, snaps at
// `threshold`. Coordinates "only one open" + "tap-outside / scroll closes"
// across instances via a window CustomEvent + document listeners. Layout,
// colors, and the reduced-motion transition live in the consuming
// component; this hook owns only the gesture + open state.
export function useSwipeReveal({
  enabled,
  revealWidth,
  threshold = 0.35,
}: Options): Result {
  const id = useId();
  const [offset, setOffset] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const startX = useRef(0);
  const startY = useRef(0);
  const axis = useRef<null | "h" | "v">(null);
  const activePointer = useRef<number | null>(null);
  const elRef = useRef<Element | null>(null);
  const offsetRef = useRef(0);
  const openRef = useRef(false);
  const wasDragRef = useRef(false);

  const applyOpen = useCallback(
    (open: boolean) => {
      openRef.current = open;
      offsetRef.current = open ? revealWidth : 0;
      setIsOpen(open);
      setOffset(offsetRef.current);
    },
    [revealWidth],
  );

  const close = useCallback(() => applyOpen(false), [applyOpen]);

  // Force closed whenever the hook goes inert (selection mode on, or the
  // viewport grows past the mobile breakpoint). Resetting state in an
  // effect is the correct tool here — we're syncing internal gesture
  // state to an external enable gate, not deriving render output.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset gesture state when the swipe gate turns off
    if (!enabled) applyOpen(false);
  }, [enabled, applyOpen]);

  // Another card opened → close this one.
  useEffect(() => {
    const onOther = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== id) applyOpen(false);
    };
    window.addEventListener(OPEN_EVENT, onOther);
    return () => window.removeEventListener(OPEN_EVENT, onOther);
  }, [id, applyOpen]);

  // While open: a tap anywhere outside, or any scroll, closes it.
  useEffect(() => {
    if (!isOpen) return;
    const onDocDown = (e: PointerEvent) => {
      if (elRef.current && !elRef.current.contains(e.target as Node)) {
        applyOpen(false);
      }
    };
    const onScroll = () => applyOpen(false);
    document.addEventListener("pointerdown", onDocDown, true);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onDocDown, true);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [isOpen, applyOpen]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (!enabled) return;
      elRef.current = e.currentTarget;
      startX.current = e.clientX;
      startY.current = e.clientY;
      axis.current = null;
      activePointer.current = e.pointerId;
      wasDragRef.current = false;
    },
    [enabled],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent) => {
      if (!enabled || activePointer.current === null) return;
      const dx = e.clientX - startX.current;
      const dy = e.clientY - startY.current;

      if (axis.current === null) {
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);
        if (adx < AXIS_DEADZONE_PX && ady < AXIS_DEADZONE_PX) return;
        if (ady > adx) {
          // Vertical intent — bail out and let the list scroll.
          axis.current = "v";
          activePointer.current = null;
          return;
        }
        axis.current = "h";
        e.currentTarget.setPointerCapture?.(e.pointerId);
      }
      if (axis.current !== "h") return;

      wasDragRef.current = true;
      setIsDragging(true);
      // Swiping left (dx < 0) grows the reveal; right shrinks it. Anchor
      // to the open/closed baseline so a drag resumes from current state.
      const base = openRef.current ? revealWidth : 0;
      const next = Math.min(revealWidth, Math.max(0, base - dx));
      offsetRef.current = next;
      setOffset(next);
    },
    [enabled, revealWidth],
  );

  const onPointerUp = useCallback(
    (e: ReactPointerEvent) => {
      if (axis.current === "h") {
        e.currentTarget.releasePointerCapture?.(e.pointerId);
        setIsDragging(false);
        const open = offsetRef.current >= threshold * revealWidth;
        applyOpen(open);
        if (open) {
          window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }));
        }
      }
      axis.current = null;
      activePointer.current = null;
    },
    [applyOpen, id, revealWidth, threshold],
  );

  const onPointerCancel = useCallback(() => {
    setIsDragging(false);
    applyOpen(openRef.current);
    axis.current = null;
    activePointer.current = null;
  }, [applyOpen]);

  return {
    offset,
    isOpen,
    isDragging,
    close,
    wasDragRef,
    surfaceProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    },
  };
}
