import { NextRequest, NextResponse } from "next/server";
import { CronExpressionParser } from "cron-parser";
import { badRequest, parseJson } from "@/server/lib/api-errors";
import { createApiHandler } from "@/server/lib/handler";
import { instanceService } from "@/server/services/InstanceService";
import { instanceCreateSchema } from "@/shared/types/schemas";
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
  };
}

export const GET = createApiHandler(async () => {
  const instances = await instanceService.getAll();
  return NextResponse.json(instances.map(publicView));
});

export const POST = createApiHandler(async (req: NextRequest) => {
  const data = await parseJson(req, instanceCreateSchema, "Invalid instance");
  if (data.autoSearchScheduleMode === "cron" && data.autoSearchCronExpression) {
    const fields = data.autoSearchCronExpression.trim().split(/\s+/);
    if (fields.length !== 5)
      throw badRequest("Invalid cron expression", "INVALID_CRON");
    try {
      CronExpressionParser.parse(data.autoSearchCronExpression);
    } catch {
      throw badRequest("Invalid cron expression", "INVALID_CRON");
    }
  }
  const instance = await instanceService.create(data);
  return NextResponse.json(publicView(instance), { status: 201 });
});
