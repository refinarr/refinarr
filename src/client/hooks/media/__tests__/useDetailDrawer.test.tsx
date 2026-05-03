// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDetailDrawer } from "../useDetailDrawer";

interface Item {
  id: number;
  title: string;
}

const items: Item[] = [
  { id: 1, title: "Alpha" },
  { id: 2, title: "Bravo" },
];

describe("useDetailDrawer", () => {
  it("starts with selectedId=null and selectedItem=null", () => {
    const { result } = renderHook(() => useDetailDrawer(items));
    expect(result.current.selectedId).toBeNull();
    expect(result.current.selectedItem).toBeNull();
  });

  it("resolves selectedItem from items when an id is selected", () => {
    const { result } = renderHook(() => useDetailDrawer(items));
    act(() => result.current.setSelectedId(2));
    expect(result.current.selectedItem).toEqual({ id: 2, title: "Bravo" });
  });

  it("returns null selectedItem when the selected id is not in items (stale id)", () => {
    const { result, rerender } = renderHook(
      ({ list }) => useDetailDrawer(list),
      { initialProps: { list: items } },
    );
    act(() => result.current.setSelectedId(2));
    expect(result.current.selectedItem).toEqual({ id: 2, title: "Bravo" });

    // List refetched and item 2 was removed (e.g. user ignored it).
    rerender({ list: [{ id: 1, title: "Alpha" }] });
    expect(result.current.selectedId).toBe(2);
    expect(result.current.selectedItem).toBeNull();
  });
});
