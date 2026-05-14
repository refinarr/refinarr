import { describe, test, expect, beforeEach } from "vitest";
import { eventBus } from "@/server/lib/event-bus";
import type { ServerEvent } from "@/shared/types/api";

describe("eventBus", () => {
  beforeEach(() => {
    eventBus.reset();
  });

  test("emits events to all subscribers in order", () => {
    const seen: ServerEvent[] = [];
    const a: ServerEvent[] = [];
    eventBus.subscribe((e) => seen.push(e));
    eventBus.subscribe((e) => a.push(e));

    eventBus.emit({ type: "queue-changed", instanceId: 1 });
    eventBus.emit({ type: "queue-cleared", instanceId: 1 });

    expect(seen).toEqual([
      { type: "queue-changed", instanceId: 1 },
      { type: "queue-cleared", instanceId: 1 },
    ]);
    expect(a).toEqual(seen);
  });

  test("unsubscribe stops further deliveries", () => {
    const seen: ServerEvent[] = [];
    const off = eventBus.subscribe((e) => seen.push(e));
    eventBus.emit({ type: "queue-changed", instanceId: 1 });
    off();
    eventBus.emit({ type: "queue-changed", instanceId: 2 });
    expect(seen).toHaveLength(1);
  });

  test("reset removes all listeners", () => {
    const seen: ServerEvent[] = [];
    eventBus.subscribe((e) => seen.push(e));
    eventBus.reset();
    eventBus.emit({ type: "queue-changed", instanceId: 1 });
    expect(seen).toHaveLength(0);
  });
});
