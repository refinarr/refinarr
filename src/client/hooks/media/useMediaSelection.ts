import { useCallback, useState } from "react";

interface HasId {
  id: number;
}

export interface MediaSelection<T extends HasId> {
  selected: Set<number>;
  selectedItems: T[];
  deletableSelected: T[];
  deletableCount: number;
  // True when every currently-loaded item is in the selection set. The
  // master "select all" checkbox in the table header reads this to
  // drive its `checked` state.
  allSelected: boolean;
  // True when SOME — but not all — items are selected. Drives the
  // master checkbox's indeterminate (partial) state.
  someSelected: boolean;
  toggle: (id: number) => void;
  // Toggle every loaded item: clears the set when `allSelected`,
  // otherwise selects every item id. Mirrors Gmail's master checkbox.
  toggleAll: () => void;
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
  // useCallback so referentially-stable across renders. Memoized
  // children (MediaTableHeader, MediaTableRow) receive these as props
  // and a fresh function identity would defeat their React.memo.
  const toggle = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const clear = useCallback(() => setSelected(new Set()), []);
  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      // Clear only when EVERY visible item is already selected — partial
      // selections should grow to select-all, not collapse to empty.
      // Comparing by size against the item list is enough because every
      // toggle goes through ids in `items`.
      const allAlreadySelected = items.length > 0 && prev.size >= items.length;
      return allAlreadySelected ? new Set() : new Set(items.map((i) => i.id));
    });
  }, [items]);
  const selectedItems = items.filter((i) => selected.has(i.id));
  const deletableSelected = isDeletable
    ? selectedItems.filter(isDeletable)
    : selectedItems;
  // allSelected matches "every item in the loaded list is selected". We
  // intentionally don't gate on `items.length > 0` outside the equality —
  // when there are zero items the master checkbox should read unchecked.
  const allSelected = items.length > 0 && selected.size === items.length;
  const someSelected = selected.size > 0 && !allSelected;
  return {
    selected,
    selectedItems,
    deletableSelected,
    deletableCount: deletableSelected.length,
    allSelected,
    someSelected,
    toggle,
    toggleAll,
    clear,
  };
}
