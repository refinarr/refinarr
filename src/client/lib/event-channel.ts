"use client";

import type { ServerEvent } from "@/shared/types/api";

type Incoming = ServerEvent | { type: "ready" };
type Listener = (event: Incoming) => void;

const LOCK_NAME = "refinarr-events-leader";
const CHANNEL_NAME = "refinarr-events";

/**
 * Cross-tab event delivery for SSE.
 *
 * Architecture: ONE EventSource per browser session, shared across all
 * open tabs. Why: HTTP/1.1 caps at 6 connections per origin, and an SSE
 * connection holds one slot for as long as the tab is open. Without
 * coordination, opening 6 tabs starves the user of slots for any other
 * fetch (movies, history, etc.) and the 7th tab fails to connect.
 *
 * Coordination uses the Web Locks API. Every tab requests an exclusive
 * lock named "refinarr-events-leader"; only one tab holds it at a time.
 * The leader opens the EventSource and forwards every received event to
 * all other tabs via BroadcastChannel. Non-leaders just listen on the
 * channel.
 *
 * When the leader tab closes, the lock releases and the next queued tab
 * takes over — there's a sub-second window with no leader, which is
 * acceptable (TanStack Query's window-focus refetch covers it).
 *
 * Fallbacks: if Web Locks are unavailable (very old browser), each tab
 * opens its own EventSource. If BroadcastChannel is unavailable, the
 * non-leader tabs just don't receive events — they fall back to
 * polling, which is the behavior we had before this layer.
 */
class EventChannel {
  private listeners = new Set<Listener>();
  private eventSource: EventSource | null = null;
  private broadcast: BroadcastChannel | null = null;
  private started = false;
  private isLeader = false;

  start(): void {
    if (this.started || typeof window === "undefined") return;
    this.started = true;

    if (typeof BroadcastChannel !== "undefined") {
      this.broadcast = new BroadcastChannel(CHANNEL_NAME);
      this.broadcast.onmessage = (e) => this.dispatch(e.data as Incoming);
    }

    if (
      typeof navigator !== "undefined" &&
      navigator.locks &&
      typeof navigator.locks.request === "function"
    ) {
      this.tryBecomeLeader();
    } else {
      // No Web Locks API — fall back to per-tab SSE. Slightly wasteful
      // but the user's still alive.
      this.openEventSource();
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Test seam — drop all listeners + close the connection. */
  reset(): void {
    this.closeEventSource();
    if (this.broadcast) {
      this.broadcast.close();
      this.broadcast = null;
    }
    this.listeners.clear();
    this.started = false;
    this.isLeader = false;
  }

  private dispatch(event: Incoming): void {
    this.listeners.forEach((l) => l(event));
  }

  private tryBecomeLeader(): void {
    // navigator.locks.request resolves when the callback returns. We
    // return a promise that only resolves on tab close, so the lock is
    // held for the tab's lifetime. Other tabs queue and one takes over
    // after this tab releases.
    void navigator.locks.request(
      LOCK_NAME,
      { mode: "exclusive" },
      () =>
        new Promise<void>((resolve) => {
          this.isLeader = true;
          this.openEventSource();

          const release = () => {
            this.closeEventSource();
            this.isLeader = false;
            resolve();
          };
          // pagehide fires on bfcache, beforeunload doesn't always.
          window.addEventListener("pagehide", release, { once: true });
          window.addEventListener("beforeunload", release, { once: true });
        }),
    );
  }

  private openEventSource(): void {
    if (this.eventSource) return;
    const es = new EventSource("/api/events");
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as Incoming;
        this.dispatch(data);
        // Forward to other tabs. BroadcastChannel doesn't echo back to
        // the originator, so leader's own dispatch above isn't doubled.
        if (this.isLeader && this.broadcast) this.broadcast.postMessage(data);
      } catch {
        // Malformed event — ignore.
      }
    };
    es.onerror = () => {
      // EventSource auto-reconnects on transient errors. We just observe;
      // no action needed unless we want backoff metrics later.
    };
    this.eventSource = es;
  }

  private closeEventSource(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}

export const eventChannel = new EventChannel();
