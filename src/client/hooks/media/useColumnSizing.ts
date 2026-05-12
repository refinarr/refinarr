"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ColumnSizingState, Updater } from "@tanstack/react-table";

const STORAGE_PREFIX = "media-table-sizing:";

function isColumnSizingState(value: unknown): value is ColumnSizingState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  // Each entry must be `string → finite number`; anything else (stale
  // shape, hand-edited JSON, foreign payload) is rejected so TanStack
  // can't crash trying to use it.
  for (const v of Object.values(value as Record<string, unknown>)) {
    if (typeof v !== "number" || !Number.isFinite(v)) return false;
  }
  return true;
}

function readStored(key: string): ColumnSizingState {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return isColumnSizingState(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeStored(key: string, value: ColumnSizingState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch {
    // Quota / private mode / disabled storage — silently no-op. The
    // user just loses persistence; the table still works in-memory.
  }
}

// Persist TanStack's column sizing state in localStorage keyed per table
// (`movies`, `shows`, etc.). Returns a [state, setter, reset] triple
// shaped to match the `state.columnSizing` + `onColumnSizingChange`
// contract TanStack expects.
export function useColumnSizing(storageKey: string) {
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() =>
    readStored(storageKey),
  );
  // Tracks the key the current `columnSizing` value was hydrated against.
  // When the caller swaps `storageKey` at runtime, the in-memory state
  // belongs to the OLD key — we must rehydrate from the NEW key before
  // writing, otherwise the persist effect would clobber the new table's
  // saved widths with the old table's sizing.
  const hydratedKeyRef = useRef(storageKey);

  useEffect(() => {
    if (hydratedKeyRef.current !== storageKey) {
      hydratedKeyRef.current = storageKey;
      setColumnSizing(readStored(storageKey));
      return;
    }
    writeStored(storageKey, columnSizing);
  }, [storageKey, columnSizing]);

  const onColumnSizingChange = useCallback(
    (updater: Updater<ColumnSizingState>) => {
      setColumnSizing((prev) =>
        typeof updater === "function" ? updater(prev) : updater,
      );
    },
    [],
  );

  const resetColumnSize = useCallback((columnId: string) => {
    setColumnSizing((prev) => {
      if (!(columnId in prev)) return prev;
      const next = { ...prev };
      delete next[columnId];
      return next;
    });
  }, []);

  return { columnSizing, onColumnSizingChange, resetColumnSize } as const;
}
