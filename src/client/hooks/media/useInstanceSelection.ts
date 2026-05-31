import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { PublicInstance } from "@/shared/types/api";
import type { ArrType } from "@/shared/types/models";
import { useInstances } from "../data/useInstances";

export function parseUrlInstance(raw: string | null): number {
  const n = Number(raw ?? "0");
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// Per-arr-type "last selected instance", remembered across visits so the
// dependent media queries (prefs/profiles/list/queue/recent) can fire on
// first render instead of waiting a round-trip for /api/instances — the
// instance-selection waterfall. Reading localStorage in a lazy initializer
// is safe here: these media pages render client-only (their useSearchParams
// sits under a Suspense boundary, so the server emits the fallback), so
// there's no server render to mismatch against.
const STORE_PREFIX = "refinarr:lastInstance:";
function readStoredInstance(arrType: ArrType): number {
  if (typeof window === "undefined") return 0;
  const n = Number(window.localStorage.getItem(STORE_PREFIX + arrType));
  return Number.isInteger(n) && n > 0 ? n : 0;
}

// Resolution order for the active instance: an explicit ?instanceId= always
// wins; while instances are still loading, fall back to the remembered id so
// dependent queries fire immediately (kills the waterfall); once loaded,
// reconcile — if the remembered id isn't a current instance of this type
// (deleted/disabled), drop to the first available.
function resolveActiveInstance(
  urlId: number,
  storedId: number,
  instances: PublicInstance[] | undefined,
  typedInstanceIds: number[],
  typedInstances: PublicInstance[],
): number {
  if (urlId > 0) return urlId;
  if (instances === undefined) return storedId;
  if (typedInstanceIds.includes(storedId)) return storedId;
  return typedInstances[0]?.id ?? 0;
}

export interface InstanceSelection {
  instances: PublicInstance[] | undefined;
  loadingInstances: boolean;
  typedInstances: PublicInstance[];
  typedInstanceIds: number[];
  instanceId: number;
  setInstanceId: (v: number) => void;
  activeInstance: number;
}

// URL is the source of truth — `instanceId` is derived from
// `?instanceId=` each render. setInstanceId writes through the
// router; useSearchParams is reactive so consumers re-render
// automatically. Any path that updates the URL (desktop picker,
// mobile tab push, browser back/forward, deep-link click) flows
// through the same channel.
export function useInstanceSelection(arrType: ArrType): InstanceSelection {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: instances, isLoading: loadingInstances } = useInstances();
  const instanceId = parseUrlInstance(searchParams.get("instanceId"));
  // Optimistic seed from the last selection (client-only lazy init).
  const [storedId] = useState(() => readStoredInstance(arrType));

  const typedInstances = instances?.filter((i) => i.type === arrType) ?? [];
  const typedInstanceIds = typedInstances.map((i) => i.id);
  const activeInstance = resolveActiveInstance(
    instanceId,
    storedId,
    instances,
    typedInstanceIds,
    typedInstances,
  );

  // Remember the resolved active instance so the next visit skips the
  // waterfall. Client-only; never writes 0 (no selection / no instances).
  useEffect(() => {
    if (activeInstance > 0) {
      window.localStorage.setItem(
        STORE_PREFIX + arrType,
        String(activeInstance),
      );
    }
  }, [activeInstance, arrType]);

  const setInstanceId = useCallback(
    (id: number) => {
      const next = new URLSearchParams(searchParams.toString());
      if (id > 0) next.set("instanceId", String(id));
      else next.delete("instanceId");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname, searchParams],
  );

  return {
    instances,
    loadingInstances,
    typedInstances,
    typedInstanceIds,
    instanceId,
    setInstanceId,
    activeInstance,
  };
}
