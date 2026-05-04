// @vitest-environment happy-dom
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  closed = false;
  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }
  close() {
    this.closed = true;
  }
  emit(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.stubGlobal("EventSource", FakeEventSource);
  // Fall back to per-tab EventSource (no Web Locks) so the leader path
  // is deterministic in tests.
  Object.defineProperty(navigator, "locks", { value: undefined, configurable: true });
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("EventChannel", () => {
  test("start() opens a single EventSource and dispatches incoming events", async () => {
    const { eventChannel } = await import("@/client/lib/event-channel");
    eventChannel.reset();
    const seen: unknown[] = [];
    eventChannel.subscribe((e) => seen.push(e));
    eventChannel.start();

    expect(FakeEventSource.instances).toHaveLength(1);
    FakeEventSource.instances[0].emit({ type: "queue-changed", instanceId: 1 });
    expect(seen).toEqual([{ type: "queue-changed", instanceId: 1 }]);
  });

  test("start() is idempotent — multiple calls don't open multiple EventSources", async () => {
    const { eventChannel } = await import("@/client/lib/event-channel");
    eventChannel.reset();
    eventChannel.start();
    eventChannel.start();
    eventChannel.start();
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  test("subscribe returns an unsubscribe that stops further dispatches", async () => {
    const { eventChannel } = await import("@/client/lib/event-channel");
    eventChannel.reset();
    const seen: unknown[] = [];
    const off = eventChannel.subscribe((e) => seen.push(e));
    eventChannel.start();

    FakeEventSource.instances[0].emit({ type: "queue-changed", instanceId: 1 });
    off();
    FakeEventSource.instances[0].emit({ type: "queue-changed", instanceId: 2 });

    expect(seen).toHaveLength(1);
  });

  test("malformed payloads are dropped without throwing", async () => {
    const { eventChannel } = await import("@/client/lib/event-channel");
    eventChannel.reset();
    const seen: unknown[] = [];
    eventChannel.subscribe((e) => seen.push(e));
    eventChannel.start();

    const es = FakeEventSource.instances[0];
    expect(() => es.onmessage?.({ data: "not-json" })).not.toThrow();
    expect(seen).toHaveLength(0);
  });

  test("reset() closes the EventSource and clears listeners", async () => {
    const { eventChannel } = await import("@/client/lib/event-channel");
    eventChannel.reset();
    eventChannel.start();
    const es = FakeEventSource.instances[0];
    eventChannel.reset();
    expect(es.closed).toBe(true);
  });
});
