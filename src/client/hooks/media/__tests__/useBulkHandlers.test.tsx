// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { UseMutationResult } from "@tanstack/react-query";
import { useBulkAbort } from "../useBulkAbort";
import { useBulkHandlers, type BulkHandlerActions } from "../useBulkHandlers";
import type { MediaSelection } from "../useMediaSelection";

interface Item {
  id: number;
  __instanceId: number;
  hasFile: boolean;
}

const items: Item[] = [
  { id: 1, __instanceId: 1, hasFile: true },
  { id: 2, __instanceId: 1, hasFile: false },
  { id: 3, __instanceId: 2, hasFile: true },
];

function makeSelection(state: { selectedItems: Item[]; deletableSelected: Item[] }): MediaSelection<Item> {
  return {
    selected: new Set(state.selectedItems.map((i) => i.id)),
    selectedItems: state.selectedItems,
    deletableSelected: state.deletableSelected,
    deletableCount: state.deletableSelected.length,
    toggle: vi.fn(),
    clear: vi.fn(),
  };
}

function makeMutation<TVars>(impl: (vars: TVars) => Promise<unknown>): UseMutationResult<unknown, unknown, TVars, unknown> {
  return { mutateAsync: vi.fn(impl) } as unknown as UseMutationResult<unknown, unknown, TVars, unknown>;
}

function makeActions(impls?: Partial<{
  search: (vars: { items: Item[]; isBulk: boolean; signal?: AbortSignal }) => Promise<unknown>;
  ignore: (vars: { items: Item[]; isBulk: boolean; signal?: AbortSignal }) => Promise<unknown>;
  deleteFn: (vars: { items: Item[]; isBulk: boolean; signal?: AbortSignal; search: boolean }) => Promise<unknown>;
}>): BulkHandlerActions<Item> {
  return {
    searchMutation: makeMutation(impls?.search ?? (async () => undefined)),
    ignoreMutation: makeMutation(impls?.ignore ?? (async () => undefined)),
    deleteMutation: makeMutation(impls?.deleteFn ?? (async () => undefined)),
  };
}

describe("useBulkHandlers", () => {
  it("handleSearch dispatches selectedItems and clears the selection on success", async () => {
    const selection = makeSelection({ selectedItems: items, deletableSelected: items.filter((i) => i.hasFile) });
    const actions = makeActions();
    const { result } = renderHook(() => {
      const abort = useBulkAbort();
      return useBulkHandlers({ selection, abort, actions });
    });
    await act(async () => {
      await result.current.handleSearch();
    });
    expect(actions.searchMutation.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ items, isBulk: true }),
    );
    expect(selection.clear).toHaveBeenCalledTimes(1);
  });

  it("handleSearch is a no-op when selection is empty", async () => {
    const selection = makeSelection({ selectedItems: [], deletableSelected: [] });
    const actions = makeActions();
    const { result } = renderHook(() => {
      const abort = useBulkAbort();
      return useBulkHandlers({ selection, abort, actions });
    });
    await act(async () => {
      await result.current.handleSearch();
    });
    expect(actions.searchMutation.mutateAsync).not.toHaveBeenCalled();
    expect(selection.clear).not.toHaveBeenCalled();
  });

  it("handleDelete uses deletableSelected (not selectedItems) and propagates the search flag", async () => {
    const selection = makeSelection({ selectedItems: items, deletableSelected: [items[0], items[2]] });
    const actions = makeActions();
    const { result } = renderHook(() => {
      const abort = useBulkAbort();
      return useBulkHandlers({ selection, abort, actions });
    });
    await act(async () => {
      await result.current.handleDelete(true);
    });
    expect(actions.deleteMutation.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ items: [items[0], items[2]], isBulk: true, search: true }),
    );
    expect(selection.clear).toHaveBeenCalledTimes(1);
  });

  it("preserves selection on AbortError (cancellation does not clear)", async () => {
    const selection = makeSelection({ selectedItems: items, deletableSelected: items });
    const actions = makeActions({
      search: async () => {
        throw new DOMException("Aborted", "AbortError");
      },
    });
    const { result } = renderHook(() => {
      const abort = useBulkAbort();
      return useBulkHandlers({ selection, abort, actions });
    });
    await act(async () => {
      await result.current.handleSearch();
    });
    expect(actions.searchMutation.mutateAsync).toHaveBeenCalled();
    // Cancel preserves selection so the user can retry/adjust.
    expect(selection.clear).not.toHaveBeenCalled();
  });

  it("rethrows non-abort errors", async () => {
    const selection = makeSelection({ selectedItems: items, deletableSelected: items });
    const actions = makeActions({
      search: async () => {
        throw new Error("server exploded");
      },
    });
    const { result } = renderHook(() => {
      const abort = useBulkAbort();
      return useBulkHandlers({ selection, abort, actions });
    });
    let caught: unknown;
    await act(async () => {
      try {
        await result.current.handleSearch();
      } catch (e) {
        caught = e;
      }
    });
    await waitFor(() => expect(caught).toBeInstanceOf(Error));
    expect((caught as Error).message).toBe("server exploded");
    expect(selection.clear).not.toHaveBeenCalled();
  });
});
