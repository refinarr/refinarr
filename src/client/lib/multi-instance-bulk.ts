import { runSerial } from "./run-serial";
import type { BulkAction, BulkProgress } from "@/client/components/media/BulkActionToolbar";

interface WithInstance {
  __instanceId: number;
}

export function groupByInstance<T extends WithInstance>(items: T[]): Map<number, T[]> {
  const groups = new Map<number, T[]>();
  for (const item of items) {
    const arr = groups.get(item.__instanceId) ?? [];
    arr.push(item);
    groups.set(item.__instanceId, arr);
  }
  return groups;
}

export interface InstanceCount {
  id: number;
  name: string;
  count: number;
}

export function buildInstanceBreakdown<T extends WithInstance>(
  items: T[],
  resolveName: (id: number) => string,
): InstanceCount[] {
  return Array.from(groupByInstance(items).entries())
    .map(([id, group]) => ({ id, name: resolveName(id), count: group.length }))
    .sort((a, b) => b.count - a.count);
}

export interface BulkRunOptions {
  isBulk: boolean;
  signal?: AbortSignal;
  action: BulkAction;
  setProgress: (p: BulkProgress | null) => void;
}

// Group `items` by their `__instanceId`, then dispatch each group's items
// serially via runSerial (so we never hammer one upstream Sonarr/Radarr) while
// running the groups in parallel via Promise.all (the natural parallelism
// boundary). Aggregates progress across all groups when isBulk is true so the
// toolbar shows a single cumulative `current/total` count.
export async function runMultiInstanceBulk<T extends WithInstance, R>(
  items: T[],
  fn: (item: T, instanceId: number) => Promise<R>,
  opts: BulkRunOptions,
): Promise<R[]> {
  const total = items.length;
  let processed = 0;
  if (opts.isBulk) opts.setProgress({ current: 0, total, action: opts.action });
  const groups = groupByInstance(items);
  const lists = await Promise.all(
    Array.from(groups.entries()).map(([instId, group]) =>
      runSerial(
        group,
        async (item) => {
          const r = await fn(item, instId);
          if (opts.isBulk) {
            processed += 1;
            opts.setProgress({ current: processed, total, action: opts.action });
          }
          return r;
        },
        undefined,
        { signal: opts.signal },
      ),
    ),
  );
  return lists.flat();
}
