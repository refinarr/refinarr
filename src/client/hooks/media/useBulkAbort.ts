import { useRef } from "react";

export interface BulkAbort {
  begin: () => AbortController;
  cancel: () => void;
  end: () => void;
}

export const isAbortError = (e: unknown): boolean =>
  e instanceof Error && e.name === "AbortError";

// Page hooks share this pattern: each bulk handler creates a fresh
// AbortController, threads its signal into runMultiInstanceBulk via a
// mutation, and clears the ref on settle. cancelBulk fires .abort() on
// whatever's active.
export function useBulkAbort(): BulkAbort {
  const ref = useRef<AbortController | null>(null);
  return {
    begin: () => {
      const c = new AbortController();
      ref.current = c;
      return c;
    },
    cancel: () => ref.current?.abort(),
    end: () => {
      ref.current = null;
    },
  };
}

// Wrap an async operation with an AbortController lifecycle: open one, run
// fn(signal), and on AbortError treat the run as cancelled (no rethrow).
// Anything else propagates so callers see real failures.
export async function runWithAbort(
  abort: BulkAbort,
  fn: (signal: AbortSignal) => Promise<unknown>,
): Promise<void> {
  const c = abort.begin();
  try {
    await fn(c.signal);
  } catch (e) {
    if (!isAbortError(e)) throw e;
  } finally {
    abort.end();
  }
}
