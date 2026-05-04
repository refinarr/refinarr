import { NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { dataCache } from "@/server/lib/DataCache";
import { appLogger } from "@/server/lib/app-logger";

export const POST = createApiHandler(async (_req, ctx) => {
  const id = Number(ctx.params.id);
  dataCache.invalidate(id);
  appLogger.info("Manual refresh triggered", {
    // TODO:  sources should be from LogSource enum",
    context: { instanceId: id },
  });
  return NextResponse.json({ ok: true });
});
