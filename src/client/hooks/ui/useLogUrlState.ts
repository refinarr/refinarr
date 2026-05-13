"use client";
import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { isLogLevel } from "@/shared/log-level";
import { LogSource } from "@/shared/types/models";
import type { LogLevel } from "@/shared/types/models";

export interface LogUrlState {
  level: LogLevel | null;
  source: string | null;
  instanceId: number | null;
  q: string;
}

interface LogUrlActions {
  setLevel: (level: LogLevel | null) => void;
  setSource: (source: string | null) => void;
  setInstanceId: (instanceId: number | null) => void;
  setQ: (q: string) => void;
  clearAll: () => void;
}

const VALID_SOURCES = new Set<string>(Object.values(LogSource));

function parseInstanceId(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parseLevel(raw: string | null): LogLevel | null {
  return raw && isLogLevel(raw) ? raw : null;
}

function parseSource(raw: string | null): string | null {
  return raw && VALID_SOURCES.has(raw) ? raw : null;
}

/**
 * URL-synced filter state for `/logs`.
 *
 * `replace` (not `push`) is used for every setter so adjusting filters
 * doesn't pollute browser history — back/forward should jump pages, not
 * step through every keystroke or chip toggle. Returns a stable
 * `LogUrlState` value derived from the current URL plus action setters.
 */
export function useLogUrlState(): LogUrlState & LogUrlActions {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const state = useMemo<LogUrlState>(
    () => ({
      level: parseLevel(searchParams.get("level")),
      source: parseSource(searchParams.get("source")),
      instanceId: parseInstanceId(searchParams.get("instanceId")),
      q: searchParams.get("q") ?? "",
    }),
    [searchParams],
  );

  const writeParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(searchParams.toString());
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams],
  );

  const setLevel = useCallback(
    (level: LogLevel | null) => writeParam("level", level),
    [writeParam],
  );
  const setSource = useCallback(
    (source: string | null) => writeParam("source", source),
    [writeParam],
  );
  const setInstanceId = useCallback(
    (id: number | null) => writeParam("instanceId", id ? String(id) : null),
    [writeParam],
  );
  const setQ = useCallback((q: string) => writeParam("q", q), [writeParam]);

  const clearAll = useCallback(() => {
    router.replace(pathname);
  }, [pathname, router]);

  return { ...state, setLevel, setSource, setInstanceId, setQ, clearAll };
}
