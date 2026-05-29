import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { parseJson, positiveInt } from "@/server/lib/api-errors";
import { preferenceRepository } from "@/server/repositories/PreferenceRepository";
import { dataCache } from "@/server/lib/data-cache";
import { appLogger } from "@/server/lib/app-logger";
import { LogSource } from "@/shared/types/models";
import { preferencesSchema } from "@/shared/types/schemas";

export const GET = createApiHandler(async (req: NextRequest) => {
  const instanceId = positiveInt(
    req.nextUrl.searchParams.get("instanceId") ?? undefined,
    "instanceId",
  );
  const prefs = await preferenceRepository.findByInstance(instanceId);
  return NextResponse.json(prefs);
});

export const PUT = createApiHandler(async (req: NextRequest) => {
  const { instanceId, cfs } = await parseJson(
    req,
    preferencesSchema,
    "Invalid preferences",
  );
  await preferenceRepository.setForInstance(instanceId, cfs);
  dataCache.invalidate(instanceId);
  appLogger.info("Custom Format preferences updated", {
    source: LogSource.Api,
    context: { instanceId, count: cfs.length },
  });
  return NextResponse.json({ ok: true });
});
