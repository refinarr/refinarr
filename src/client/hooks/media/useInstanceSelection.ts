import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useInstances } from "../data/useInstances";
import type { ArrType, Instance } from "@/shared/types/models";

export type ActiveInstance = number | "all";

export function parseUrlInstance(raw: string | null): ActiveInstance {
  if (raw === "all") return "all";
  const n = Number(raw ?? "0");
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export interface InstanceSelection {
  instances: Instance[] | undefined;
  loadingInstances: boolean;
  typedInstances: Instance[];
  typedInstanceIds: number[];
  instanceId: ActiveInstance;
  setInstanceId: (v: ActiveInstance) => void;
  isAllMode: boolean;
  activeInstance: ActiveInstance;
  helperInstance: number;
}

// Owns the instance dropdown's state for one arrType (Radarr or Sonarr).
// `activeInstance` is "all" when the selector is on All-X and a numeric id
// otherwise (defaulting to the first matching instance when nothing is
// chosen). `helperInstance` is what page-level helper queries
// (qualityProfiles, preferences) should fetch — fall back to the first
// matching instance in "all" mode.
export function useInstanceSelection(arrType: ArrType): InstanceSelection {
  const searchParams = useSearchParams();
  const { data: instances, isLoading: loadingInstances } = useInstances();
  const [instanceId, setInstanceId] = useState<ActiveInstance>(() =>
    parseUrlInstance(searchParams.get("instanceId")),
  );

  const typedInstances = instances?.filter((i) => i.type === arrType) ?? [];
  const typedInstanceIds = typedInstances.map((i) => i.id);
  const isAllMode = instanceId === "all";
  const activeInstance: ActiveInstance = isAllMode
    ? "all"
    : (typeof instanceId === "number" && instanceId > 0
        ? instanceId
        : typedInstances[0]?.id ?? 0);
  const helperInstance = isAllMode ? typedInstances[0]?.id ?? 0 : (activeInstance as number);

  return {
    instances,
    loadingInstances,
    typedInstances,
    typedInstanceIds,
    instanceId,
    setInstanceId,
    isAllMode,
    activeInstance,
    helperInstance,
  };
}
