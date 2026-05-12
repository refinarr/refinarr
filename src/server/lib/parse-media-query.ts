import type {
  MediaQuery,
  MonitorStatus,
  Severity,
} from "@/shared/types/models";

const VALID_SEVERITIES: ReadonlySet<string> = new Set<Severity>([
  "critical",
  "low",
  "warning",
  "ok",
  "missing",
]);
const VALID_SORT_BY: ReadonlySet<string> = new Set<MediaQuery["sortBy"]>([
  "score",
  "title",
  "added",
  "size",
]);
const VALID_ORDER: ReadonlySet<string> = new Set<"asc" | "desc">([
  "asc",
  "desc",
]);
const VALID_MONITOR_STATUS: ReadonlySet<string> = new Set<MonitorStatus>([
  "all",
  "monitored",
  "unmonitored",
  "missing",
]);

function isSeverity(v: string): v is Severity {
  return VALID_SEVERITIES.has(v);
}

function isSortBy(v: string): v is MediaQuery["sortBy"] {
  return VALID_SORT_BY.has(v);
}

function isOrder(v: string): v is "asc" | "desc" {
  return VALID_ORDER.has(v);
}

function isMonitorStatus(v: string): v is MonitorStatus {
  return VALID_MONITOR_STATUS.has(v);
}

function parseIdList(raw: string | null): number[] | undefined {
  if (!raw) return undefined;
  const ids = raw
    .split(",")
    .map((s) => Number(s.trim()))
    // Integer-only — `1.5` and `1e2` are rejected so the URL can't
    // smuggle non-integer values into a SQL-shaped id filter.
    .filter((n) => Number.isInteger(n) && n > 0);
  return ids.length > 0 ? ids : undefined;
}

function parseSeverityList(raw: string | null): Severity[] | undefined {
  if (!raw) return undefined;
  const out = raw
    .split(",")
    .map((s) => s.trim())
    .filter(isSeverity);
  return out.length > 0 ? out : undefined;
}

function parseFiniteNumber(raw: string | null): number | undefined {
  if (raw === null || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function parseMatchMode(raw: string | null): "any" | "all" {
  return raw === "any" ? "any" : "all";
}

// Pulls every MediaQuery field except `instanceId`, `page`, `limit` (which
// are route-shape concerns) out of the URL. One source so radarr/sonarr
// routes can't drift on filter parsing.
export function parseMediaQuery(
  s: URLSearchParams,
): Omit<MediaQuery, "page" | "limit"> {
  const rawSortBy = s.get("sortBy");
  const sortBy: MediaQuery["sortBy"] =
    rawSortBy !== null && isSortBy(rawSortBy) ? rawSortBy : "score";
  const rawOrder = s.get("order");
  const order: "asc" | "desc" =
    rawOrder !== null && isOrder(rawOrder) ? rawOrder : "asc";
  return {
    sortBy,
    order,
    minScore: parseFiniteNumber(s.get("minScore")),
    maxScore: parseFiniteNumber(s.get("maxScore")),
    minSize: parseFiniteNumber(s.get("minSize")),
    maxSize: parseFiniteNumber(s.get("maxSize")),
    q: s.get("q") ?? undefined,
    profileIds: parseIdList(s.get("profileIds")),
    severities: parseSeverityList(s.get("severities")),
    missingCfIds: parseIdList(s.get("missingCfIds")),
    missingCfMatch: parseMatchMode(s.get("missingCfMatch")),
    hasNegativeCfIds: parseIdList(s.get("hasNegativeCfIds")),
    hasNegativeCfMatch: parseMatchMode(s.get("hasNegativeCfMatch")),
    // Default true (preserves the legacy "flagged items only" contract).
    // Only an explicit `?flaggedOnly=false` opens the "Show all" view.
    flaggedOnly: s.get("flaggedOnly") !== "false",
    monitorStatus: (() => {
      const raw = s.get("monitorStatus");
      return raw !== null && isMonitorStatus(raw) ? raw : "all";
    })(),
  };
}
