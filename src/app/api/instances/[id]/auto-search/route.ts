import { NextResponse } from "next/server";
import { CronExpressionParser } from "cron-parser";
import { notFound, positiveInt } from "@/server/lib/api-errors";
import { createApiHandler } from "@/server/lib/handler";
import { autoRunner, computeNextRun } from "@/server/lib/auto-runner";
import { instanceRepository } from "@/server/repositories/InstanceRepository";
import type { AutoSearchStatus } from "@/shared/types/api";

function isCronValid(expr: string): boolean {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  try {
    CronExpressionParser.parse(expr);
    return true;
  } catch {
    return false;
  }
}

export const GET = createApiHandler(async (_req, ctx) => {
  const id = positiveInt(ctx.params.id, "id");
  const instance = await instanceRepository.findById(id);
  if (!instance) throw notFound();

  const cronValid = isCronValid(instance.autoSearchCronExpression);
  const nextRunAt = instance.autoSearchEnabled
    ? computeNextRun({
        mode: instance.autoSearchScheduleMode,
        intervalMinutes: instance.autoSearchIntervalMinutes,
        cronExpression: instance.autoSearchCronExpression,
        lastRunAt: instance.autoSearchLastRunAt,
      })
    : null;

  const status: AutoSearchStatus = {
    enabled: instance.autoSearchEnabled,
    scheduleMode: instance.autoSearchScheduleMode,
    intervalMinutes: instance.autoSearchIntervalMinutes,
    cronExpression: instance.autoSearchCronExpression,
    cronValid,
    batchLimit: instance.autoSearchBatchLimit,
    monitoredOnly: instance.autoSearchMonitoredOnly,
    scope: instance.autoSearchScope,
    lastRunAt: instance.autoSearchLastRunAt?.toISOString() ?? null,
    nextRunAt: nextRunAt?.toISOString() ?? null,
    running: autoRunner.isRunning(id),
  };

  return NextResponse.json(status);
});
