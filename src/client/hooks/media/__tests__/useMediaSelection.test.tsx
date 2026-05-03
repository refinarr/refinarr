// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMediaSelection } from "../useMediaSelection";

interface Item {
  id: number;
  hasFile: boolean;
}

const items: Item[] = [
  { id: 1, hasFile: true },
  { id: 2, hasFile: false },
  { id: 3, hasFile: true },
];

describe("useMediaSelection", () => {
  it("starts empty and toggles items in and out of the set", () => {
    const { result } = renderHook(() => useMediaSelection(items));
    expect(result.current.selected.size).toBe(0);

    act(() => result.current.toggle(1));
    expect(result.current.selected.has(1)).toBe(true);
    expect(result.current.selectedItems).toHaveLength(1);

    act(() => result.current.toggle(1));
    expect(result.current.selected.has(1)).toBe(false);
    expect(result.current.selectedItems).toHaveLength(0);
  });

  it("derives selectedItems from the items array", () => {
    const { result } = renderHook(() => useMediaSelection(items));
    act(() => {
      result.current.toggle(1);
      result.current.toggle(3);
    });
    expect(result.current.selectedItems.map((i) => i.id).sort()).toEqual([1, 3]);
  });

  it("filters deletableSelected by the predicate", () => {
    const { result } = renderHook(() =>
      useMediaSelection(items, (i) => i.hasFile),
    );
    act(() => {
      result.current.toggle(1);
      result.current.toggle(2);
      result.current.toggle(3);
    });
    expect(result.current.selectedItems).toHaveLength(3);
    expect(result.current.deletableSelected.map((i) => i.id).sort()).toEqual([1, 3]);
    expect(result.current.deletableCount).toBe(2);
  });

  it("clears the selection", () => {
    const { result } = renderHook(() => useMediaSelection(items));
    act(() => {
      result.current.toggle(1);
      result.current.toggle(2);
    });
    expect(result.current.selected.size).toBe(2);
    act(() => result.current.clear());
    expect(result.current.selected.size).toBe(0);
  });
});
