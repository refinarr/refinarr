import { describe, test, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET, _activeClientCount } from "@/app/api/events/route";
import { eventBus } from "@/server/lib/event-bus";

/**
 * Reads stream chunks until either `count` SSE `data:` events have been
 * seen or the timeout elapses. Filters out heartbeat comment lines.
 */
async function readEvents(
  body: ReadableStream<Uint8Array>,
  count: number,
  timeoutMs = 1000,
): Promise<unknown[]> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const events: unknown[] = [];
  let buffer = "";
  const deadline = Date.now() + timeoutMs;

  while (events.length < count && Date.now() < deadline) {
    const remaining = Math.max(50, deadline - Date.now());
    const { done, value } = await Promise.race([
      reader.read(),
      new Promise<{ done: true; value: undefined }>((resolve) =>
        setTimeout(() => resolve({ done: true, value: undefined }), remaining),
      ),
    ]);
    if (done || !value) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? ""; // retain incomplete trailing segment
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        events.push(JSON.parse(line.slice(6)));
      }
    }
  }
  try {
    await reader.cancel();
  } catch {
    /* already cancelled or stream closed */
  }
  return events;
}

describe("GET /api/events", () => {
  test("opens an SSE stream, sends ready, then forwards bus events", async () => {
    const ac = new AbortController();
    const req = new NextRequest("http://localhost/api/events", {
      signal: ac.signal,
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(res.headers.get("X-Accel-Buffering")).toBe("no");

    // The "start" callback runs synchronously when the stream is read
    // for the first time; the "ready" event lands right after.
    const readPromise = readEvents(res.body!, 2);
    // Give the controller a tick to enqueue "ready" before emitting.
    await new Promise((r) => setTimeout(r, 10));
    eventBus.emit({ type: "queue-changed", instanceId: 5 });

    const events = await readPromise;
    expect(events[0]).toEqual({ type: "ready" });
    expect(events[1]).toEqual({ type: "queue-changed", instanceId: 5 });

    ac.abort();
  });

  test("decrements activeClients on abort", async () => {
    const before = _activeClientCount();
    const ac = new AbortController();
    const req = new NextRequest("http://localhost/api/events", {
      signal: ac.signal,
    });
    const res = await GET(req);
    // Touch the stream to start it.
    const reader = res.body!.getReader();
    await new Promise((r) => setTimeout(r, 10));
    expect(_activeClientCount()).toBe(before + 1);
    ac.abort();
    reader.cancel();
    // Cleanup is async; give it a tick.
    await new Promise((r) => setTimeout(r, 10));
    expect(_activeClientCount()).toBe(before);
  });
});
