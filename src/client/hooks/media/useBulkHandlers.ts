import type { UseMutationResult } from "@tanstack/react-query";
import { runWithAbort, type BulkAbort } from "./useBulkAbort";
import type { MediaSelection } from "./useMediaSelection";

interface HasId {
  id: number;
}

// We don't depend on the mutation's full generics here — only that each
// mutation accepts items in the shape both useBulkMediaActions and the page
// hooks already use.
type BulkMutate<T> = UseMutationResult<unknown, unknown, { items: T[]; isBulk: boolean; signal?: AbortSignal }, unknown>;
type DeleteMutate<T> = UseMutationResult<unknown, unknown, { items: T[]; isBulk: boolean; signal?: AbortSignal; search: boolean }, unknown>;

export interface BulkHandlerActions<T> {
  searchMutation: BulkMutate<T>;
  ignoreMutation: BulkMutate<T>;
  deleteMutation: DeleteMutate<T>;
}

export interface BulkHandlersArgs<T extends HasId> {
  selection: MediaSelection<T>;
  abort: BulkAbort;
  actions: BulkHandlerActions<T>;
}

export interface BulkHandlers {
  handleSearch: () => Promise<void>;
  handleIgnore: () => Promise<void>;
  handleDelete: (search: boolean) => Promise<void>;
}

// Wraps the runWithAbort + selection.clear() pattern used by the three bulk
// handlers. Each handler:
//   - bails if there's nothing selected (or nothing deletable for delete)
//   - opens an AbortController via the shared `abort` lifecycle
//   - dispatches the mutation
//   - clears the selection on success
//   - swallows AbortError (the mutation's onError already toasts "Cancelled")
export function useBulkHandlers<T extends HasId>({
  selection,
  abort,
  actions,
}: BulkHandlersArgs<T>): BulkHandlers {
  const handleSearch = async () => {
    if (!selection.selectedItems.length) return;
    const items = selection.selectedItems;
    await runWithAbort(abort, async (signal) => {
      await actions.searchMutation.mutateAsync({ items, isBulk: true, signal });
      selection.clear();
    });
  };

  const handleIgnore = async () => {
    if (!selection.selectedItems.length) return;
    const items = selection.selectedItems;
    await runWithAbort(abort, async (signal) => {
      await actions.ignoreMutation.mutateAsync({ items, isBulk: true, signal });
      selection.clear();
    });
  };

  const handleDelete = async (search: boolean) => {
    if (!selection.deletableSelected.length) return;
    const items = selection.deletableSelected;
    await runWithAbort(abort, async (signal) => {
      await actions.deleteMutation.mutateAsync({ items, search, isBulk: true, signal });
      selection.clear();
    });
  };

  return { handleSearch, handleIgnore, handleDelete };
}
