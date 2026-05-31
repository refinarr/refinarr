import { NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { notFound, positiveInt } from "@/server/lib/api-errors";
import { instanceService } from "@/server/services/InstanceService";
import { dataCache } from "@/server/lib/data-cache";
import { appLogger } from "@/server/lib/app-logger";
import { LogSource } from "@/shared/types/models";

export const POST = createApiHandler(async (_req, ctx) => {
  const id = positiveInt(ctx.params.id, "id");
  // Don't report success for an instance that doesn't exist.
  if (!(await instanceService.getById(id))) throw notFound();
  dataCache.invalidate(id);
  appLogger.info("Manual refresh triggered", {
    source: LogSource.Api,
    context: { instanceId: id },
  });
  return NextResponse.json({ ok: true });
});
