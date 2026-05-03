import { useState } from "react";

interface HasId {
  id: number;
}

export interface DetailDrawer<T extends HasId> {
  selectedId: number | null;
  setSelectedId: (id: number | null) => void;
  selectedItem: T | null;
}

// Detail-drawer open state derived from a row id. selectedItem is re-derived
// from `items` on every render, so a refetch that changes the underlying
// list will surface stale-id behavior naturally (the drawer disappears when
// its row is no longer present).
export function useDetailDrawer<T extends HasId>(items: T[]): DetailDrawer<T> {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selectedItem = items.find((i) => i.id === selectedId) ?? null;
  return { selectedId, setSelectedId, selectedItem };
}
