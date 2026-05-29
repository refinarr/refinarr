/**
 * Timer abstraction injected into the long-lived background services —
 * the auto-runner, status-poller, and search-worker — so their scheduling
 * is a controllable dependency rather than an ambient global.
 *
 * - Production wires `realScheduler` (the default).
 * - The integration-test setup swaps in `inertScheduler`: timers are
 *   registered but never fire, so a route's `start()` / `refresh()` side
 *   effect can't spin up real *arr polling and trip MSW's
 *   `onUnhandledRequest` guard.
 * - Each service's own test file keeps `realScheduler` and drives time
 *   with vitest fake timers, which replace the global timer functions
 *   `realScheduler` delegates to.
 */

/**
 * Timer handle. A `realScheduler` handle is a Node timer; an
 * `inertScheduler` handle is the `__inert` sentinel. The union lets the
 * implementation narrow without an unguarded cast; callers treat it as
 * opaque and just hand it back to `clearTimeout` / `clearInterval`.
 */
export type SchedulerHandle = NodeJS.Timeout | { readonly __inert: true };

export interface Scheduler {
  setTimeout(callback: () => void, ms: number): SchedulerHandle;
  clearTimeout(handle: SchedulerHandle): void;
  setInterval(callback: () => void, ms: number): SchedulerHandle;
  clearInterval(handle: SchedulerHandle): void;
}

/** Delegates to the Node global timer functions. */
export const realScheduler: Scheduler = {
  setTimeout: (callback, ms) => {
    const handle = setTimeout(callback, ms);
    // A background timer must never be the reason the process stays alive.
    handle.unref?.();
    return handle;
  },
  clearTimeout: (handle) => {
    if ("__inert" in handle) return;
    clearTimeout(handle);
  },
  setInterval: (callback, ms) => {
    const handle = setInterval(callback, ms);
    handle.unref?.();
    return handle;
  },
  clearInterval: (handle) => {
    if ("__inert" in handle) return;
    clearInterval(handle);
  },
};

// A handle with no behaviour — inertScheduler's timers never fire, so
// there is nothing for clearTimeout/clearInterval to cancel.
const INERT_HANDLE: SchedulerHandle = Object.freeze({ __inert: true } as const);

/** Registers timers that never fire — used to keep services dormant in tests. */
export const inertScheduler: Scheduler = {
  setTimeout: () => INERT_HANDLE,
  clearTimeout: () => {},
  setInterval: () => INERT_HANDLE,
  clearInterval: () => {},
};

/**
 * Schedule a one-shot (0ms) callback through `scheduler` and record its
 * handle in `tracked` so a later `stop()` can cancel it. The wrapper drops
 * its own handle once it fires, so the set never accumulates.
 *
 * The background services use this for their "drain/poll now" kicks: those
 * must obey the same gate as the recurring timers (an inert scheduler keeps
 * them dormant) yet still be cancellable on teardown — an untracked one-shot
 * could otherwise fire after the service was meant to be stopped.
 */
export function scheduleTrackedOnce(
  scheduler: Scheduler,
  tracked: Set<SchedulerHandle>,
  run: () => void,
): void {
  // Holder so the callback can delete its own handle: the handle isn't
  // known until setTimeout returns, and the 0ms callback always runs after
  // the assignment below completes.
  const slot: { handle?: SchedulerHandle } = {};
  slot.handle = scheduler.setTimeout(() => {
    if (slot.handle) tracked.delete(slot.handle);
    run();
  }, 0);
  tracked.add(slot.handle);
}
