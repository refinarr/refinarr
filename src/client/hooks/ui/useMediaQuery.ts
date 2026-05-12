"use client";
import { useSyncExternalStore } from "react";

// Subscribe to a CSS media query and return its current match state.
// Built on React 18's useSyncExternalStore so the subscription is
// SSR-safe (returns the server snapshot during hydration), automatically
// cleans up on unmount, and stays in sync across React renders without
// the manual useEffect+useState dance. Mirrors qui's hook of the same
// name so behaviour is consistent across our two stacks.
export function useMediaQuery(query: string): boolean {
  const subscribe = (callback: () => void): (() => void) => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return () => undefined;
    }
    const mql = window.matchMedia(query);
    if (mql.addEventListener) {
      mql.addEventListener("change", callback);
      return () => mql.removeEventListener("change", callback);
    }
    // Legacy Safari fallback.
    const legacy = mql as MediaQueryList & {
      addListener?: (cb: () => void) => void;
      removeListener?: (cb: () => void) => void;
    };
    legacy.addListener?.(callback);
    return () => legacy.removeListener?.(callback);
  };

  const getSnapshot = (): boolean => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  };

  // SSR / first-paint placeholder. The real value lands once the client
  // mounts and useSyncExternalStore reads getSnapshot.
  const getServerSnapshot = (): boolean => false;

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// Convenience for the `lg:` Tailwind breakpoint (1024px). Use this
// anywhere a component picks a desktop vs mobile render path.
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}

// Honour the OS-level "reduce motion" accessibility setting. Use this
// to switch smooth-scroll/animations to instant equivalents — important
// for users with motion sensitivity (vestibular disorders, etc.).
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}
