"use client";
import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "rfn-density";
const CHANGE_EVENT = "rfn:density-change";

// "compact"/"cozy" = desktop table row densities; "poster" = responsive
// poster grid (visual browse, desktop + mobile). "card" is the MOBILE
// rendering only — it's no longer a desktop-selectable view (#129), but
// the value is still accepted so a previously-stored "card" degrades
// gracefully (desktop → cozy table; mobile → card list either way).
export type Density = "compact" | "cozy" | "card" | "poster";

interface Result {
  density: Density;
  setDensity: (next: Density) => void;
  // Legacy 2-state toggle (compact ↔ cozy). Kept for any consumer that
  // wants binary toggling; the new top-bar button uses `cycle()` instead.
  toggle: () => void;
  // Advance density to the next mode in the cycle. Order: cozy →
  // compact → poster → cozy.
  cycle: () => void;
}

// Single source of truth for the desktop view-mode cycle. DensityToggle
// imports this for its "next mode" tooltip so the label can't drift from
// the actual cycling logic below. "card" is intentionally absent — it's
// the mobile-only rendering; cycling from a stale stored "card" restarts
// at cozy (indexOf returns -1 → nextIdx 0, see cycle() below).
export const CYCLE_ORDER: Density[] = ["cozy", "compact", "poster"];

// In-memory fallback for storage-restricted environments (private mode,
// sandboxed iframes, locked-down corporate browsers). Without this,
// localStorage failures would silently revert every density toggle.
let memoryDensity: Density | null = null;

function readStored(): Density | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (
      raw === "compact" ||
      raw === "cozy" ||
      raw === "card" ||
      raw === "poster"
    ) {
      return raw;
    }
    // Storage reads can succeed (return null) even when writes throw —
    // e.g. some private-mode browsers. Fall through to the in-memory
    // cache so a toggle made earlier in the session isn't lost.
    return memoryDensity;
  } catch {
    return memoryDensity;
  }
}

function writeStored(value: Density): void {
  try {
    localStorage.setItem(STORAGE_KEY, value);
    // Storage works — clear the in-memory fallback so a subsequent
    // user-initiated `localStorage.clear()` (or testing teardown) can't
    // resurrect a stale value via the fallback path.
    memoryDensity = null;
  } catch {
    // Storage-restricted environment (private mode, sandboxed iframe).
    // Keep the value in memory so the UI updates within the session.
    memoryDensity = value;
  }
}

function dispatchChange(): void {
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

function subscribe(onChange: () => void): () => void {
  const storageHandler = (event: StorageEvent) => {
    if (event.key === null || event.key === STORAGE_KEY) onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", storageHandler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", storageHandler);
  };
}

function getSnapshot(): Density {
  return readStored() ?? "cozy";
}

// SSR / first-client-paint placeholder. Cozy is the default everywhere.
function getServerSnapshot(): Density {
  return "cozy";
}

export function useDensity(): Result {
  const density = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const setDensity = useCallback((next: Density) => {
    writeStored(next);
    dispatchChange();
  }, []);

  const toggle = useCallback(() => {
    writeStored(getSnapshot() === "compact" ? "cozy" : "compact");
    dispatchChange();
  }, []);

  const cycle = useCallback(() => {
    const current = getSnapshot();
    const idx = CYCLE_ORDER.indexOf(current);
    // If current density isn't in the cycle, restart at the first mode.
    const nextIdx = idx === -1 ? 0 : (idx + 1) % CYCLE_ORDER.length;
    writeStored(CYCLE_ORDER[nextIdx]);
    dispatchChange();
  }, []);

  return { density, setDensity, toggle, cycle };
}
