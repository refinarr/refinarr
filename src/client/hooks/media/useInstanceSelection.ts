import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { PublicInstance } from "@/shared/types/api";
import type { ArrType } from "@/shared/types/models";
import { useInstances } from "../data/useInstances";

export function parseUrlInstance(raw: string | null): number {
  const n = Number(raw ?? "0");
  return Number.isFinite(n) && n > 0 ? n : 0;
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

  const typedInstances = instances?.filter((i) => i.type === arrType) ?? [];
  const typedInstanceIds = typedInstances.map((i) => i.id);
  const activeInstance =
    instanceId > 0 ? instanceId : (typedInstances[0]?.id ?? 0);

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
