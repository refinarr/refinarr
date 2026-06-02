import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { instanceService } from "@/server/services/InstanceService";
import { dataCache } from "@/server/lib/data-cache";
import {
  badRequest,
  notFound,
  parseJson,
  positiveInt,
} from "@/server/lib/api-errors";
import { isValidCronExpression } from "@/shared/cron";
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
  const existing = await instanceService.getById(id);
  if (!existing) throw notFound();
  const update = await parseJson(
    req,
    instanceUpdateSchema,
    "Invalid instance update",
  );
  // Cron validation has to consider the EFFECTIVE expression — the
  // payload's expression if present, otherwise whatever is already
  // stored on the instance. Previously we only validated when both
  // `mode === "cron"` and `expression` were in the same payload, so a
  // client that flipped mode to cron without resending the expression
  // could leave an invalid/stale stored value driving the runner.
  if (update.autoSearchScheduleMode === "cron") {
    const effectiveExpr =
      update.autoSearchCronExpression ?? existing.autoSearchCronExpression;
    if (!isValidCronExpression(effectiveExpr)) {
      throw badRequest("Invalid cron expression", "INVALID_CRON");
    }
  }
  const { autoSearchPausedUntil, ...rest } = update;
  const updateData =
    autoSearchPausedUntil === undefined
      ? rest
      : {
          ...rest,
          autoSearchPausedUntil: autoSearchPausedUntil
            ? new Date(autoSearchPausedUntil)
            : null,
        };
  const instance = await instanceService.update(id, updateData);
  // URL / API key / enabled changes mean the cached movies/series snapshot
  // points at the old upstream (or stale disabled state). Drop it so the
  // next fetch refreshes from the new instance config.
  dataCache.invalidate(id);
  return NextResponse.json(publicView(instance));
});

export const DELETE = createApiHandler(async (_req, ctx) => {
  const id = positiveInt(ctx.params.id, "id");
  // Return 404 (not a Prisma 500) when the instance is already gone.
  if (!(await instanceService.getById(id))) throw notFound();
  await instanceService.delete(id);
  dataCache.invalidate(id);
  return NextResponse.json({ ok: true });
});
