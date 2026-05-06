import { NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { positiveInt } from "@/server/lib/api-errors";
import { dataCache } from "@/server/lib/DataCache";
import { appLogger } from "@/server/lib/app-logger";
import { LogSource } from "@/server/lib/log-sources";

export const POST = createApiHandler(async (_req, ctx) => {
  const id = positiveInt(ctx.params.id, "id");
  dataCache.invalidate(id);
  appLogger.info("Manual refresh triggered", {
    source: LogSource.Api,
    context: { instanceId: id },
  });
  return NextResponse.json({ ok: true });
});
