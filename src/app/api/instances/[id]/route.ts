import { NextRequest, NextResponse } from "next/server";
import { CronExpressionParser } from "cron-parser";
import { createApiHandler } from "@/server/lib/handler";
import { instanceService } from "@/server/services/InstanceService";
import { dataCache } from "@/server/lib/data-cache";
import {
  badRequest,
  notFound,
  parseJson,
  positiveInt,
} from "@/server/lib/api-errors";
import { instanceUpdateSchema } from "@/shared/types/schemas";
import type { Instance } from "@/shared/types/models";
import type { PublicInstance } from "@/shared/types/api";

function publicView(i: Instance): PublicInstance {
  return {
    id: i.id,
    type: i.type,
    name: i.name,
    url: i.url,
    enabled: i.enabled,
    scoringMode: i.scoringMode,
    searchesPerHour: i.searchesPerHour,
    showAllMedia: i.showAllMedia,
    createdAt: i.createdAt,
    autoSearchEnabled: i.autoSearchEnabled,
    autoSearchScheduleMode: i.autoSearchScheduleMode,
    autoSearchIntervalMinutes: i.autoSearchIntervalMinutes,
    autoSearchCronExpression: i.autoSearchCronExpression,
    autoSearchBatchLimit: i.autoSearchBatchLimit,
    autoSearchLastRunAt: i.autoSearchLastRunAt,
    autoSearchMonitoredOnly: i.autoSearchMonitoredOnly,
    autoSearchScope: i.autoSearchScope,
    autoSearchPickStrategy: i.autoSearchPickStrategy,
    autoSearchCooldownHours: i.autoSearchCooldownHours,
    autoSearchPausedUntil: i.autoSearchPausedUntil,
    autoSearchScoringMode: i.autoSearchScoringMode,
  };
}

export const GET = createApiHandler(async (_req, ctx) => {
  const id = positiveInt(ctx.params.id, "id");
  const instance = await instanceService.getById(id);
  if (!instance) throw notFound();
  return NextResponse.json(publicView(instance));
});

export const PUT = createApiHandler(async (req: NextRequest, ctx) => {
  const id = positiveInt(ctx.params.id, "id");
  const update = await parseJson(
    req,
    instanceUpdateSchema,
    "Invalid instance update",
  );
  if (
    update.autoSearchScheduleMode === "cron" &&
    update.autoSearchCronExpression
  ) {
    const fields = update.autoSearchCronExpression.trim().split(/\s+/);
    if (fields.length !== 5)
      throw badRequest("Invalid cron expression", "INVALID_CRON");
    try {
      CronExpressionParser.parse(update.autoSearchCronExpression);
    } catch {
      throw badRequest("Invalid cron expression", "INVALID_CRON");
    }
  }
  const { autoSearchPausedUntil, ...rest } = update;
  let parsedPausedUntil: Date | null | undefined;
  if (autoSearchPausedUntil !== undefined) {
    parsedPausedUntil = autoSearchPausedUntil
      ? new Date(autoSearchPausedUntil)
      : null;
  }
  const instance = await instanceService.update(id, {
    ...rest,
    autoSearchPausedUntil: parsedPausedUntil,
  });
  // URL / API key / enabled changes mean the cached movies/series snapshot
  // points at the old upstream (or stale disabled state). Drop it so the
  // next fetch refreshes from the new instance config.
  dataCache.invalidate(id);
  return NextResponse.json(publicView(instance));
});

export const DELETE = createApiHandler(async (_req, ctx) => {
  const id = positiveInt(ctx.params.id, "id");
  await instanceService.delete(id);
  dataCache.invalidate(id);
  return NextResponse.json({ ok: true });
});
