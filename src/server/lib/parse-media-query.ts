import type { MediaQuery, Severity } from "@/shared/types/models";

const VALID_SEVERITIES: ReadonlySet<Severity> = new Set([
  "critical",
  "low",
  "warning",
  "ok",
  "missing",
]);
const VALID_SORT_BY: ReadonlySet<MediaQuery["sortBy"]> = new Set([
  "score",
  "title",
  "added",
  "size",
]);
const VALID_ORDER: ReadonlySet<"asc" | "desc"> = new Set(["asc", "desc"]);

function parseIdList(raw: string | null): number[] | undefined {
  if (!raw) return undefined;
  const ids = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return ids.length > 0 ? ids : undefined;
}

function parseSeverityList(raw: string | null): Severity[] | undefined {
  if (!raw) return undefined;
  const out = raw
    .split(",")
    .map((s) => s.trim() as Severity)
    .filter((s) => VALID_SEVERITIES.has(s));
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
  const sortBy: MediaQuery["sortBy"] = VALID_SORT_BY.has(
    rawSortBy as MediaQuery["sortBy"],
  )
    ? (rawSortBy as MediaQuery["sortBy"])
    : "score";
  const rawOrder = s.get("order");
  const order: "asc" | "desc" = VALID_ORDER.has(rawOrder as "asc" | "desc")
    ? (rawOrder as "asc" | "desc")
    : "asc";
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
    onlyMissing: s.get("onlyMissing") === "true",
  };
}
