import { describe, it, expect, vi } from "vitest";
import { runSerial } from "../run-serial";

describe("runSerial", () => {
  it("processes items in order and returns results in the same order", async () => {
    const order: number[] = [];
    const result = await runSerial([1, 2, 3], async (n) => {
      order.push(n);
      return n * 10;
    });
    expect(order).toEqual([1, 2, 3]);
    expect(result).toEqual([10, 20, 30]);
  });

  it("emits progress 0/N at start and current/N after each item", async () => {
    const progress: Array<[number, number]> = [];
    await runSerial([1, 2, 3], async (n) => n, (current, total) => {
      progress.push([current, total]);
    });
    expect(progress).toEqual([
      [0, 3],
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  it("emits 0/0 for an empty array and resolves to []", async () => {
    const onProgress = vi.fn();
    const result = await runSerial<number, number>([], async (n) => n, onProgress);
    expect(result).toEqual([]);
    expect(onProgress).toHaveBeenCalledWith(0, 0);
    expect(onProgress).toHaveBeenCalledTimes(1);
  });

  it("propagates a function-level error and stops processing", async () => {
    const seen: number[] = [];
    await expect(
      runSerial([1, 2, 3], async (n) => {
        seen.push(n);
        if (n === 2) throw new Error("boom");
        return n;
      })
    ).rejects.toThrow("boom");
    expect(seen).toEqual([1, 2]);
  });

  it("aborts before the next item when the signal is already aborted", async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const onProgress = vi.fn();
    await expect(
      runSerial([1, 2, 3], async (n) => n, onProgress, { signal: ctrl.signal })
    ).rejects.toMatchObject({ name: "AbortError" });
    // 0/3 emitted at start; abort fires before any item runs.
    expect(onProgress).toHaveBeenCalledWith(0, 3);
  });

  it("aborts mid-run between items when the signal is set during processing", async () => {
    const ctrl = new AbortController();
    const seen: number[] = [];
    const onProgress = vi.fn();
    await expect(
      runSerial(
        [1, 2, 3],
        async (n) => {
          seen.push(n);
          if (n === 1) ctrl.abort();
          return n;
        },
        onProgress,
        { signal: ctrl.signal },
      )
    ).rejects.toMatchObject({ name: "AbortError" });
    // Only the first item ran; the abort check fires before the second.
    expect(seen).toEqual([1]);
  });
});
