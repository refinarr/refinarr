import { describe, test, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/logs/stream/route";
import { eventBus } from "@/server/lib/event-bus";
import type { AppLogEntry } from "@/shared/types/models";

interface ParsedFrame {
  id: number | null;
  event: string | null;
  data: unknown;
}

async function readFrames(
  body: ReadableStream<Uint8Array>,
  count: number,
  timeoutMs = 1000,
): Promise<ParsedFrame[]> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const frames: ParsedFrame[] = [];
  let buffer = "";
  const deadline = Date.now() + timeoutMs;

  while (frames.length < count && Date.now() < deadline) {
    const remaining = Math.max(50, deadline - Date.now());
    const { done, value } = await Promise.race([
      reader.read(),
      new Promise<{ done: true; value: undefined }>((resolve) =>
        setTimeout(() => resolve({ done: true, value: undefined }), remaining),
      ),
    ]);
    if (done || !value) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";
    for (const block of blocks) {
      const frame: ParsedFrame = { id: null, event: null, data: undefined };
      for (const line of block.split("\n")) {
        if (line.startsWith("id: ")) frame.id = Number(line.slice(4));
        else if (line.startsWith("event: ")) frame.event = line.slice(7);
        else if (line.startsWith("data: ")) {
          try { frame.data = JSON.parse(line.slice(6)); } catch { /* skip */ }
        }
      }
      if (frame.id !== null || frame.event !== null || frame.data !== undefined) {
        frames.push(frame);
      }
    }
  }
  reader.releaseLock();
  return frames;
}

function makeEntry(id: number, message = `m${id}`, level: AppLogEntry["level"] = "info"): AppLogEntry {
  return {
    id,
    level,
    message,
    source: null,
    context: null,
    createdAt: new Date(),
  };
}

describe("GET /api/logs/stream (bus-driven)", () => {
  test("forwards applog bus events to the client in real time", async () => {
    const ac = new AbortController();
    const req = new NextRequest("http://localhost/api/logs/stream", {
      signal: ac.signal,
    });
    const res = await GET(req, { params: Promise.resolve({}) });

    const readPromise = readFrames(res.body!, 3);
    await new Promise((r) => setTimeout(r, 30));

    eventBus.emit({ type: "applog", entry: makeEntry(101, "first") });
    eventBus.emit({ type: "applog", entry: makeEntry(102, "second") });

    const frames = await readPromise;
    // Frame 1: ready event after backfill.
    expect(frames.find((f) => f.event === "ready")).toBeDefined();
    // Frames 2-3: forwarded bus events.
    const forwarded = frames.filter((f) => f.id !== null);
    expect(forwarded.map((f) => f.id)).toEqual([101, 102]);

    ac.abort();
  });

  test("level filter drops non-matching applog events", async () => {
    const ac = new AbortController();
    const req = new NextRequest("http://localhost/api/logs/stream?level=error", {
      signal: ac.signal,
    });
    const res = await GET(req, { params: Promise.resolve({}) });

    const readPromise = readFrames(res.body!, 2, 500);
    await new Promise((r) => setTimeout(r, 30));

    eventBus.emit({ type: "applog", entry: makeEntry(201, "info-noise", "info") });
    eventBus.emit({ type: "applog", entry: makeEntry(202, "real-error", "error") });

    const frames = await readPromise;
    const forwarded = frames.filter((f) => f.id !== null);
    expect(forwarded.map((f) => f.id)).toEqual([202]);

    ac.abort();
  });

  test("dedupes by id when bus delivers an entry already in the backfill", async () => {
    const { appLogRepository } = await import("@/server/repositories/AppLogRepository");
    const persisted = await appLogRepository.create({
      level: "info",
      message: "already-here",
      source: null,
      context: null,
    });

    const ac = new AbortController();
    const req = new NextRequest("http://localhost/api/logs/stream", {
      signal: ac.signal,
    });
    const res = await GET(req, { params: Promise.resolve({}) });

    const readPromise = readFrames(res.body!, 4, 500);
    await new Promise((r) => setTimeout(r, 30));

    // Re-emit the same entry as if the bus race-fired during backfill.
    eventBus.emit({ type: "applog", entry: persisted });
    // Then a brand-new entry to confirm the stream is still alive.
    eventBus.emit({ type: "applog", entry: makeEntry(persisted.id + 1, "fresh") });

    const frames = await readPromise;
    const ids = frames.filter((f) => f.id !== null).map((f) => f.id);
    // The persisted entry appears once (from backfill), and the +1 entry
    // appears once (from bus). No duplicate of persisted.id.
    expect(ids.filter((id) => id === persisted.id)).toHaveLength(1);
    expect(ids).toContain(persisted.id + 1);

    ac.abort();
  });
});
