import { describe, test, expect, vi, afterEach } from "vitest";
import {
  realScheduler,
  inertScheduler,
  scheduleTrackedOnce,
  type SchedulerHandle,
} from "@/server/lib/scheduler";

afterEach(() => {
  vi.useRealTimers();
});

describe("realScheduler", () => {
  test("setTimeout fires the callback after the delay; clearTimeout cancels it", () => {
    vi.useFakeTimers();
    const fired = vi.fn();
    realScheduler.setTimeout(fired, 1000);
    vi.advanceTimersByTime(999);
    expect(fired).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fired).toHaveBeenCalledTimes(1);

    const cancelled = vi.fn();
    const handle = realScheduler.setTimeout(cancelled, 1000);
    realScheduler.clearTimeout(handle);
    vi.advanceTimersByTime(2000);
    expect(cancelled).not.toHaveBeenCalled();
  });

  test("setInterval fires repeatedly; clearInterval cancels it", () => {
    vi.useFakeTimers();
    const tick = vi.fn();
    const handle = realScheduler.setInterval(tick, 100);
    vi.advanceTimersByTime(350);
    expect(tick).toHaveBeenCalledTimes(3);
    realScheduler.clearInterval(handle);
    vi.advanceTimersByTime(1000);
    expect(tick).toHaveBeenCalledTimes(3);
  });

  test("clearTimeout / clearInterval ignore an inert handle without throwing", () => {
    // realScheduler should never receive an inertScheduler handle, but the
    // SchedulerHandle union makes the `__inert` guard reachable — exercise it
    // so the narrowing branch is covered and proven safe.
    const inertHandle = inertScheduler.setTimeout(() => {}, 0);
    expect(() => realScheduler.clearTimeout(inertHandle)).not.toThrow();
    expect(() => realScheduler.clearInterval(inertHandle)).not.toThrow();
  });
});

describe("inertScheduler", () => {
  test("setTimeout / setInterval register a handle but the callback never fires", () => {
    vi.useFakeTimers();
    const never = vi.fn();
    const timeoutHandle = inertScheduler.setTimeout(never, 0);
    const intervalHandle = inertScheduler.setInterval(never, 0);
    vi.advanceTimersByTime(10_000);
    expect(never).not.toHaveBeenCalled();
    // clear is a no-op — must not throw on the inert handle.
    expect(() => inertScheduler.clearTimeout(timeoutHandle)).not.toThrow();
    expect(() => inertScheduler.clearInterval(intervalHandle)).not.toThrow();
  });

  test("hands back one shared, frozen handle", () => {
    const fromTimeout = inertScheduler.setTimeout(() => {}, 0);
    const fromInterval = inertScheduler.setInterval(() => {}, 0);
    expect(fromTimeout).toBe(fromInterval);
    expect(Object.isFrozen(fromTimeout)).toBe(true);
  });
});

describe("scheduleTrackedOnce", () => {
  test("runs the callback and drops its own handle from the set", async () => {
    vi.useFakeTimers();
    const tracked = new Set<SchedulerHandle>();
    const run = vi.fn();
    scheduleTrackedOnce(realScheduler, tracked, run);
    // Handle is recorded immediately; callback fires only on the next tick.
    expect(tracked.size).toBe(1);
    expect(run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);
    // The fired one-shot removes itself so the set never accumulates.
    expect(tracked.size).toBe(0);
  });

  test("a tracked handle can be cancelled before it fires", async () => {
    vi.useFakeTimers();
    const tracked = new Set<SchedulerHandle>();
    const run = vi.fn();
    scheduleTrackedOnce(realScheduler, tracked, run);
    for (const handle of tracked) realScheduler.clearTimeout(handle);
    tracked.clear();
    await vi.advanceTimersByTimeAsync(100);
    expect(run).not.toHaveBeenCalled();
  });

  test("under an inert scheduler the callback never fires", async () => {
    vi.useFakeTimers();
    const tracked = new Set<SchedulerHandle>();
    const run = vi.fn();
    scheduleTrackedOnce(inertScheduler, tracked, run);
    expect(tracked.size).toBe(1);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(run).not.toHaveBeenCalled();
  });
});
