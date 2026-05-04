"use client";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { eventChannel } from "@/client/lib/event-channel";
import { queryKeys } from "@/client/lib/query-keys";

/**
 * Subscribes the active TanStack Query client to server-pushed events
 * over the shared EventChannel. Mounted once at app shell level so a
 * single SSE connection (via leader election) drives every tab's
 * cache invalidations.
 *
 * Mapping is intentionally over-broad: each event invalidates anything
 * that could plausibly be affected. Cheaper than threading event-type
 * specifics into every hook, and TanStack Query merges concurrent
 * invalidations.
 */
export function useServerEvents() {
  const qc = useQueryClient();

  useEffect(() => {
    eventChannel.start();
    return eventChannel.subscribe((event) => {
      switch (event.type) {
        case "queue-changed":
        case "queue-cleared":
          qc.invalidateQueries({ queryKey: queryKeys.searchQueue(event.instanceId) });
          qc.invalidateQueries({ queryKey: ["search-queue", "all"] });
          break;
        case "history-changed":
          qc.invalidateQueries({ queryKey: queryKeys.recentSearches(event.instanceId) });
          qc.invalidateQueries({ queryKey: ["history"] });
          qc.invalidateQueries({ queryKey: queryKeys.searchQueue(event.instanceId) });
          qc.invalidateQueries({ queryKey: ["search-queue", "all"] });
          break;
        case "ready":
          // Connection established — no-op. Useful for future telemetry.
          break;
      }
    });
  }, [qc]);
}
