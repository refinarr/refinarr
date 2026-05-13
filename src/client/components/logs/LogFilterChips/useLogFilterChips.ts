"use client";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { FilterChip } from "@/client/components/common/ActiveFilterChips/ActiveFilterChips";
import { LogSource } from "@/shared/types/models";
import type { LogLevel } from "@/shared/types/models";
import type { PublicInstance } from "@/shared/types/api";

interface Options {
  level: LogLevel | null;
  source: string | null;
  instanceId: number | null;
  q: string;
  instances: PublicInstance[] | undefined;
  setLevel: (level: LogLevel | null) => void;
  setSource: (source: string | null) => void;
  setInstanceId: (id: number | null) => void;
  setQ: (q: string) => void;
}

export function useLogFilterChips({
  level,
  source,
  instanceId,
  q,
  instances,
  setLevel,
  setSource,
  setInstanceId,
  setQ,
}: Options): FilterChip[] {
  const tLevel = useTranslations("logs.levelLabels");
  const tSource = useTranslations("logs.source");
  const tChips = useTranslations("logs.chips");

  return useMemo(() => {
    const chips: FilterChip[] = [];
    if (level) {
      chips.push({
        key: `level:${level}`,
        label: tChips("level", { label: tLevel(level) }),
        onRemove: () => setLevel(null),
      });
    }
    if (source) {
      const known = (Object.values(LogSource) as readonly string[]).includes(
        source,
      );
      chips.push({
        key: `source:${source}`,
        label: tChips("source", {
          label: known
            ? tSource(source as Parameters<typeof tSource>[0])
            : source,
        }),
        onRemove: () => setSource(null),
      });
    }
    if (instanceId) {
      const inst = instances?.find((i) => i.id === instanceId);
      chips.push({
        key: `instance:${instanceId}`,
        label: tChips("instance", {
          name: inst ? inst.name : `#${instanceId}`,
        }),
        onRemove: () => setInstanceId(null),
      });
    }
    if (q.trim()) {
      chips.push({
        key: `q:${q}`,
        label: tChips("search", { q }),
        onRemove: () => setQ(""),
      });
    }
    return chips;
  }, [
    level,
    source,
    instanceId,
    q,
    instances,
    setLevel,
    setSource,
    setInstanceId,
    setQ,
    tChips,
    tLevel,
    tSource,
  ]);
}
