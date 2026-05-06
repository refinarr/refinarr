import { useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ArrType, Instance } from "@/shared/types/models";
import { useInstances } from "../data/useInstances";

export function parseUrlInstance(raw: string | null): number {
  const n = Number(raw ?? "0");
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export interface InstanceSelection {
  instances: Instance[] | undefined;
  loadingInstances: boolean;
  typedInstances: Instance[];
  typedInstanceIds: number[];
  instanceId: number;
  setInstanceId: (v: number) => void;
  activeInstance: number;
}

export function useInstanceSelection(arrType: ArrType): InstanceSelection {
  const searchParams = useSearchParams();
  const { data: instances, isLoading: loadingInstances } = useInstances();
  const [instanceId, setInstanceId] = useState<number>(() =>
    parseUrlInstance(searchParams.get("instanceId")),
  );

  const typedInstances = instances?.filter((i) => i.type === arrType) ?? [];
  const typedInstanceIds = typedInstances.map((i) => i.id);
  const activeInstance =
    instanceId > 0 ? instanceId : (typedInstances[0]?.id ?? 0);

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
