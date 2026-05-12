"use client";
import { useCallback, useMemo, useSyncExternalStore } from "react";

const CHANGE_EVENT = "rfn:instance-card-collapsed-change";

interface Result {
  collapsed: boolean;
  setCollapsed: (next: boolean) => void;
  toggle: () => void;
}

const memory = new Map<number, boolean>();

function storageKey(id: number): string {
  return `rfn-inst-collapsed:${id}`;
}

function readStored(id: number): boolean {
  try {
    const raw = localStorage.getItem(storageKey(id));
    if (raw === "true") return true;
    if (raw === "false") return false;
    return memory.get(id) ?? false;
  } catch {
    return memory.get(id) ?? false;
  }
}

function writeStored(id: number, value: boolean): void {
  try {
    localStorage.setItem(storageKey(id), value ? "true" : "false");
  } catch {
    memory.set(id, value);
  }
}

function dispatchChange(): void {
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

function makeSubscribe(id: number) {
  return (onChange: () => void): (() => void) => {
    const storageHandler = (event: StorageEvent) => {
      if (event.key === null || event.key === storageKey(id)) onChange();
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener("storage", storageHandler);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener("storage", storageHandler);
    };
  };
}

function getServerSnapshot(): boolean {
  return false;
}

export function useInstanceCardCollapsed(id: number): Result {
  // Memoize subscribe + getSnapshot per id. Without memoization,
  // useSyncExternalStore would unsubscribe + resubscribe on every
  // render of the consuming component (and re-read the snapshot
  // through a different function reference), which is what React's
  // own docs warn about.
  const subscribe = useMemo(() => makeSubscribe(id), [id]);
  const getSnapshot = useCallback(() => readStored(id), [id]);
  const collapsed = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const setCollapsed = useCallback(
    (next: boolean) => {
      writeStored(id, next);
      dispatchChange();
    },
    [id],
  );

  const toggle = useCallback(() => {
    writeStored(id, !readStored(id));
    dispatchChange();
  }, [id]);

  return { collapsed, setCollapsed, toggle };
}
