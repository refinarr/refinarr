import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { preferenceRepository } from "@/server/repositories/PreferenceRepository";
import { dataCache } from "@/server/lib/DataCache";
import { appLogger } from "@/server/lib/app-logger";

export const GET = createApiHandler(async (req: NextRequest) => {
  const instanceId = Number(req.nextUrl.searchParams.get("instanceId"));
  const prefs = await preferenceRepository.findByInstance(instanceId);
  return NextResponse.json(prefs);
});

export const PUT = createApiHandler(async (req: NextRequest) => {
  const { instanceId, cfs } = await req.json();
  await preferenceRepository.setForInstance(instanceId, cfs);
  dataCache.invalidate(instanceId);
  appLogger.info("Custom Format preferences updated", {
    source: "preferences-route",
    context: { instanceId, count: Array.isArray(cfs) ? cfs.length : 0 },
  });
  return NextResponse.json({ ok: true });
});
