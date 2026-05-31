import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/server/lib/search-worker", () => ({
  searchWorker: { stop: vi.fn() },
}));
vi.mock("@/server/lib/status-poller", () => ({
  statusPoller: { stop: vi.fn() },
}));
vi.mock("@/server/lib/auto-runner", () => ({
  autoRunner: { stop: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock("@/server/lib/app-logger", () => ({
  appLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { registerShutdownHandlers } from "@/server/lib/shutdown";
import { searchWorker } from "@/server/lib/search-worker";
import { statusPoller } from "@/server/lib/status-poller";
import { autoRunner } from "@/server/lib/auto-runner";

describe("registerShutdownHandlers", () => {
  let cleanup: (() => void) | undefined;

  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup?.());

  test("SIGTERM stops all three workers then exits 0", async () => {
    const onExit = vi.fn();
    cleanup = registerShutdownHandlers(onExit);

    process.emit("SIGTERM");

    await vi.waitFor(() => expect(onExit).toHaveBeenCalledWith(0));
    expect(searchWorker.stop).toHaveBeenCalledTimes(1);
    expect(statusPoller.stop).toHaveBeenCalledTimes(1);
    expect(autoRunner.stop).toHaveBeenCalledTimes(1);
  });

  test("re-entrancy: a second signal during shutdown is ignored", async () => {
    const onExit = vi.fn();
    cleanup = registerShutdownHandlers(onExit);

    process.emit("SIGTERM");
    process.emit("SIGINT");

    await vi.waitFor(() => expect(onExit).toHaveBeenCalledWith(0));
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(searchWorker.stop).toHaveBeenCalledTimes(1);
  });
});
