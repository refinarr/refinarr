import { badRequest } from "@/server/lib/api-errors";
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

// Strict: an explicitly-provided value that isn't a known option is a 400
// (not silently coerced to the default), so a scripting caller learns its
// query was malformed instead of getting the unfiltered list. An absent
// param still falls back to the default.
function pickEnum<T extends string>(
  raw: string | null,
  valid: ReadonlySet<string>,
  name: string,
  fallback: T,
): T {
  if (raw === null) return fallback;
  if (!valid.has(raw)) throw badRequest(`Invalid ${name}`, "INVALID_QUERY");
  return raw as T;
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

// Stricter than parseFiniteNumber — used for media-id exact match where
// 0, negatives, and fractions are nonsensical inputs. An invalid value
// would otherwise trigger the exact-id short-circuit in MediaService
// and return an empty list (misleading for malformed URLs).
function parsePositiveInt(raw: string | null): number | undefined {
  if (raw === null || raw === "") return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

function parseMatchMode(raw: string | null, name: string): "any" | "all" {
  if (raw === null) return "all";
  if (raw !== "any" && raw !== "all")
    throw badRequest(`Invalid ${name}`, "INVALID_QUERY");
  return raw;
}

// Pulls every MediaQuery field except `instanceId`, `page`, `limit` (which
// are route-shape concerns) out of the URL. One source so radarr/sonarr
// routes can't drift on filter parsing.
export function parseMediaQuery(
  s: URLSearchParams,
): Omit<MediaQuery, "page" | "limit"> {
  const sortBy = pickEnum<MediaQuery["sortBy"]>(
    s.get("sortBy"),
    VALID_SORT_BY,
    "sortBy",
    "score",
  );
  const order = pickEnum<"asc" | "desc">(
    s.get("order"),
    VALID_ORDER,
    "order",
    "asc",
  );
  const rawFlaggedOnly = s.get("flaggedOnly");
  if (
    rawFlaggedOnly !== null &&
    rawFlaggedOnly !== "true" &&
    rawFlaggedOnly !== "false"
  ) {
    throw badRequest("Invalid flaggedOnly", "INVALID_QUERY");
  }
  return {
    sortBy,
    order,
    minScore: parseFiniteNumber(s.get("minScore")),
    maxScore: parseFiniteNumber(s.get("maxScore")),
    minSize: parseFiniteNumber(s.get("minSize")),
    maxSize: parseFiniteNumber(s.get("maxSize")),
    q: s.get("q") ?? undefined,
    mediaId: parsePositiveInt(s.get("mediaId")),
    profileIds: parseIdList(s.get("profileIds")),
    severities: parseSeverityList(s.get("severities")),
    missingCfIds: parseIdList(s.get("missingCfIds")),
    missingCfMatch: parseMatchMode(s.get("missingCfMatch"), "missingCfMatch"),
    hasNegativeCfIds: parseIdList(s.get("hasNegativeCfIds")),
    hasNegativeCfMatch: parseMatchMode(
      s.get("hasNegativeCfMatch"),
      "hasNegativeCfMatch",
    ),
    // Default true (preserves the legacy "flagged items only" contract).
    // Only an explicit `?flaggedOnly=false` opens the "Show all" view.
    flaggedOnly: rawFlaggedOnly !== "false",
    monitorStatus: pickEnum<MonitorStatus>(
      s.get("monitorStatus"),
      VALID_MONITOR_STATUS,
      "monitorStatus",
      "all",
    ),
  };
}
