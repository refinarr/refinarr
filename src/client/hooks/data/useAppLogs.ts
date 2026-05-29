"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/client/lib/api";
import type { AppLogEntry, LogLevel } from "@/shared/types/models";

export interface AppLogFilters {
  level?: LogLevel;
  q?: string;
  source?: string;
  instanceId?: number;
}

const MAX_ENTRIES = 500;

export function useAppLogs(filters: AppLogFilters = {}) {
  const [entries, setEntries] = useState<AppLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    esRef.current?.close();

    setEntries([]);
    setTotal(0);
    setIsLoading(true);
    setIsConnected(false);

    const qs = new URLSearchParams();
    if (filters.level) qs.set("level", filters.level);
    if (filters.source) qs.set("source", filters.source);
    if (filters.instanceId) qs.set("instanceId", String(filters.instanceId));
    if (filters.q) qs.set("q", filters.q);

    const es = new EventSource(`/api/logs/stream?${qs}`);
    esRef.current = es;

    es.onopen = () => setIsConnected(true);
    // On connection failure (server returned 4xx/5xx, or the request was
    // aborted before "ready") clear isLoading too — otherwise the spinner
    // hangs while EventSource auto-reconnects in a loop and the user
    // can't see the empty-state / "no matches" UI underneath.
    es.onerror = () => {
      setIsConnected(false);
      setIsLoading(false);
    };

    es.addEventListener("ready", () => setIsLoading(false));

    es.onmessage = (event: MessageEvent<string>) => {
      try {
        const entry = JSON.parse(event.data) as AppLogEntry;
        setEntries((prev) => {
          const next = [entry, ...prev];
          return next.length > MAX_ENTRIES ? next.slice(0, MAX_ENTRIES) : next;
        });
        setTotal((n) => n + 1);
      } catch {
        // malformed event — skip
      }
    };
  }, [filters.level, filters.q, filters.source, filters.instanceId]);

  useEffect(() => {
    // SSE subscribe-to-external-system pattern. connect() opens an EventSource
    // and resets the entry buffer; that's exactly what effects are for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    connect();
    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, [connect]);

  return { entries, total, isLoading, isConnected, reconnect: connect };
}

export function useClearAppLogs() {
  return useMutation({
    mutationFn: () => api.delete<{ ok: boolean }>("/logs"),
  });
}
