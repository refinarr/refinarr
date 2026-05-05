import { useState } from "react";

interface HasId {
  id: number;
}

export interface MediaSelection<T extends HasId> {
  selected: Set<number>;
  selectedItems: T[];
  deletableSelected: T[];
  deletableCount: number;
  toggle: (id: number) => void;
  clear: () => void;
}

// Selection set + per-render derivations. `items` is the current list the
// page is rendering; `isDeletable` (optional) lets the caller carve out the
// subset that's actually deletable so the bulk delete handler skips items
// without files.
export function useMediaSelection<T extends HasId>(
  items: T[],
  isDeletable?: (item: T) => boolean,
): MediaSelection<T> {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const clear = () => setSelected(new Set());
  const selectedItems = items.filter((i) => selected.has(i.id));
  const deletableSelected = isDeletable
    ? selectedItems.filter(isDeletable)
    : selectedItems;
  return {
    selected,
    selectedItems,
    deletableSelected,
    deletableCount: deletableSelected.length,
    toggle,
    clear,
  };
}
