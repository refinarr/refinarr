"use client";
import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "rfn-sidebar-open";
const DESKTOP_QUERY = "(min-width: 768px)";
const CHANGE_EVENT = "rfn:sidebar-change";

interface Result {
  open: boolean;
  toggle: () => void;
  setOpen: (open: boolean) => void;
}

function readStored(): boolean | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "true") return true;
    if (raw === "false") return false;
    return null;
  } catch {
    return null;
  }
}

function writeStored(value: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, value ? "true" : "false");
  } catch {
    // localStorage unavailable — fall through silently
  }
}

function dispatchChange(): void {
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

function getSnapshot(): boolean {
  const stored = readStored();
  if (stored !== null) return stored;
  return window.matchMedia(DESKTOP_QUERY).matches;
}

// SSR / first-client-paint placeholder. The real value lands once the
// client mounts and useSyncExternalStore reads getSnapshot.
function getServerSnapshot(): boolean {
  return false;
}

export function useSidebarOpen(): Result {
  const open = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setOpen = useCallback((next: boolean) => {
    writeStored(next);
    dispatchChange();
  }, []);

  const toggle = useCallback(() => {
    writeStored(!getSnapshot());
    dispatchChange();
  }, []);

  return { open, toggle, setOpen };
}
