import { describe, it, expect, vi } from "vitest";
import {
  groupByInstance,
  buildInstanceBreakdown,
  runMultiInstanceBulk,
} from "../multi-instance-bulk";

interface Item {
  id: number;
  __instanceId: number;
}

const items: Item[] = [
  { id: 1, __instanceId: 1 },
  { id: 2, __instanceId: 2 },
  { id: 3, __instanceId: 1 },
  { id: 4, __instanceId: 1 },
  { id: 5, __instanceId: 2 },
];

describe("groupByInstance", () => {
  it("groups items by their __instanceId", () => {
    const groups = groupByInstance(items);
    expect(groups.size).toBe(2);
    expect(groups.get(1)).toHaveLength(3);
    expect(groups.get(2)).toHaveLength(2);
  });

  it("returns an empty map for empty input", () => {
    expect(groupByInstance<Item>([]).size).toBe(0);
  });
});

describe("buildInstanceBreakdown", () => {
  it("returns counts sorted descending", () => {
    const breakdown = buildInstanceBreakdown(items, (id) => `Inst-${id}`);
    expect(breakdown).toEqual([
      { id: 1, name: "Inst-1", count: 3 },
      { id: 2, name: "Inst-2", count: 2 },
    ]);
  });

  it("uses the resolveName fallback for unknown ids", () => {
    const breakdown = buildInstanceBreakdown(
      [{ id: 1, __instanceId: 99 }],
      (id) => `unknown-${id}`,
    );
    expect(breakdown[0]).toEqual({ id: 99, name: "unknown-99", count: 1 });
  });
});

describe("runMultiInstanceBulk", () => {
  it("dispatches each item to its group's instanceId and returns flattened results", async () => {
    const calls: Array<[number, number]> = [];
    const setProgress = vi.fn();
    const result = await runMultiInstanceBulk(
      items,
      async (item, instId) => {
        calls.push([item.id, instId]);
        return { ok: item.id };
      },
      { isBulk: false, action: "search", setProgress },
    );
    expect(result).toHaveLength(5);
    expect(calls.find(([id]) => id === 1)?.[1]).toBe(1);
    expect(calls.find(([id]) => id === 2)?.[1]).toBe(2);
    expect(setProgress).not.toHaveBeenCalled();
  });

  it("emits cumulative progress across groups when isBulk is true", async () => {
    const setProgress = vi.fn();
    await runMultiInstanceBulk(
      items,
      async (item) => item.id,
      { isBulk: true, action: "delete", setProgress },
    );
    // First call is the 0/N initial tick.
    expect(setProgress).toHaveBeenNthCalledWith(1, { current: 0, total: 5, action: "delete" });
    // Last call should be 5/5 with the same action.
    const lastCall = setProgress.mock.calls.at(-1)?.[0];
    expect(lastCall).toEqual({ current: 5, total: 5, action: "delete" });
    // Cumulative count must reach exactly N — no over- or under-counting across
    // parallel groups.
    expect(setProgress).toHaveBeenCalledTimes(items.length + 1);
  });

  it("propagates errors from the per-item function", async () => {
    await expect(
      runMultiInstanceBulk(
        items,
        async (item) => {
          if (item.id === 3) throw new Error("boom");
          return item.id;
        },
        { isBulk: false, action: "search", setProgress: vi.fn() },
      ),
    ).rejects.toThrow("boom");
  });

  it("aborts subsequent items when the signal is aborted mid-run", async () => {
    const ctrl = new AbortController();
    const seen: number[] = [];
    await expect(
      runMultiInstanceBulk(
        items,
        async (item) => {
          seen.push(item.id);
          if (item.id === 1) ctrl.abort();
          return item.id;
        },
        { isBulk: false, action: "search", setProgress: vi.fn(), signal: ctrl.signal },
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    // The first item in each group might have run before abort propagates;
    // what matters is that not every item ran.
    expect(seen.length).toBeLessThan(items.length);
  });
});
