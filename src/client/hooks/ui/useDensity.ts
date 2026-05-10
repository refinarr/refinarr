"use client";
import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "rfn-density";
const CHANGE_EVENT = "rfn:density-change";

export type Density = "compact" | "cozy";

interface Result {
  density: Density;
  setDensity: (next: Density) => void;
  toggle: () => void;
}

// In-memory fallback for storage-restricted environments (private mode,
// sandboxed iframes, locked-down corporate browsers). Without this,
// localStorage failures would silently revert every density toggle.
let memoryDensity: Density | null = null;

function readStored(): Density | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "compact" || raw === "cozy") return raw;
    return null;
  } catch {
    // localStorage unavailable — use the in-memory cache so the user's
    // density choice from this session still applies.
    return memoryDensity;
  }
}

function writeStored(value: Density): void {
  try {
    localStorage.setItem(STORAGE_KEY, value);
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

  return { density, setDensity, toggle };
}
