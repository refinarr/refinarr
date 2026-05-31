import { LogSource } from "@/shared/types/models";
import { appLogger } from "./app-logger";
import { autoRunner } from "./auto-runner";
import { searchWorker } from "./search-worker";
import { statusPoller } from "./status-poller";

// Wire SIGTERM/SIGINT → the workers' stop() methods so the process exits
// promptly on `docker stop`/`restart`. Without a handler, Node ignores the
// signal and Docker waits the full 10s grace before SIGKILL — the dominant
// cost of a container restart.
//
// `onExit` is injectable so tests can assert the exit code without killing
// the test runner; production uses process.exit. Returns a cleanup that
// detaches the listeners (tests use it; the server never needs to).
export function registerShutdownHandlers(
  onExit: (code: number) => void = (code) => process.exit(code),
): () => void {
  let inFlight = false;

  const handle = (signal: NodeJS.Signals) => {
    if (inFlight) return;
    inFlight = true;
    // Direct stdout, before the async appLogger — pino's DB-backed transport
    // may not flush before the process exits, so this is the one log line
    // guaranteed to prove the handler fired (vs. Next's own handler winning).
    console.log(`[shutdown] ${signal} received`);
    appLogger.info("Graceful shutdown started", {
      source: LogSource.System,
      context: { signal },
    });

    // Safety net: if any stop() hangs, force-exit so PID 1 still dies fast
    // (better than Docker's 10s SIGKILL fallback). unref() so this timer
    // never keeps the loop alive on its own.
    const safety = setTimeout(() => {
      appLogger.warn("Graceful shutdown timed out — forcing exit", {
        source: LogSource.System,
      });
      onExit(1);
    }, 4000);
    safety.unref();

    // Workers are independent; stop them concurrently. stop() is sync for
    // search-worker/status-poller and async for auto-runner —
    // Promise.allSettled normalizes both and never rejects.
    Promise.allSettled([
      Promise.resolve(searchWorker.stop()),
      Promise.resolve(statusPoller.stop()),
      Promise.resolve(autoRunner.stop()),
    ]).then(() => {
      clearTimeout(safety);
      appLogger.info("Graceful shutdown complete", {
        source: LogSource.System,
      });
      onExit(0);
    });
  };

  process.on("SIGTERM", handle);
  process.on("SIGINT", handle);

  return () => {
    process.off("SIGTERM", handle);
    process.off("SIGINT", handle);
  };
}
