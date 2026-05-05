import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { seriesService } from "@/server/services/SeriesService";

function parseIdList(raw: string | null): number[] | undefined {
  if (!raw) return undefined;
  const ids = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return ids.length > 0 ? ids : undefined;
}

function parseMatchMode(raw: string | null): "any" | "all" {
  return raw === "any" ? "any" : "all";
}

export const GET = createApiHandler(async (req: NextRequest) => {
  const s = req.nextUrl.searchParams;
  const instanceId = Number(s.get("instanceId"));
  const page = Number(s.get("page") ?? "1");
  const limit = Number(s.get("limit") ?? "50");
  const sortBy = (s.get("sortBy") ?? "score") as
    | "score"
    | "title"
    | "added"
    | "size";
  const order = (s.get("order") ?? "asc") as "asc" | "desc";
  const maxScore = s.has("maxScore") ? Number(s.get("maxScore")) : undefined;
  const q = s.get("q") ?? undefined;
  const profileId = s.has("profileId") ? Number(s.get("profileId")) : undefined;
  const missingCfIds = parseIdList(s.get("missingCfIds"));
  const missingCfMatch = parseMatchMode(s.get("missingCfMatch"));
  const hasNegativeCfIds = parseIdList(s.get("hasNegativeCfIds"));
  const hasNegativeCfMatch = parseMatchMode(s.get("hasNegativeCfMatch"));
  const onlyMissing = s.get("onlyMissing") === "true";

  const { items, total } = await seriesService.getFlaggedSeries(instanceId, {
    page,
    limit,
    sortBy,
    order,
    maxScore,
    q,
    profileId,
    missingCfIds,
    missingCfMatch,
    hasNegativeCfIds,
    hasNegativeCfMatch,
    onlyMissing,
  });

  return NextResponse.json({
    items,
    total,
    page,
    limit,
    hasMore: page * limit < total,
  });
});
