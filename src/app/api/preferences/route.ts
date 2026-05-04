import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { preferenceRepository } from "@/server/repositories/PreferenceRepository";
import { dataCache } from "@/server/lib/DataCache";
import { appLogger } from "@/server/lib/app-logger";
import { preferencesSchema } from "@/shared/types/schemas";

export const GET = createApiHandler(async (req: NextRequest) => {
  const instanceId = Number(req.nextUrl.searchParams.get("instanceId"));
  if (!Number.isInteger(instanceId) || instanceId <= 0) {
    return NextResponse.json({ error: "Invalid instanceId" }, { status: 400 });
  }
  const prefs = await preferenceRepository.findByInstance(instanceId);
  return NextResponse.json(prefs);
});

export const PUT = createApiHandler(async (req: NextRequest) => {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = preferencesSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid preferences" }, { status: 400 });
  const { instanceId, cfs } = parsed.data;
  await preferenceRepository.setForInstance(instanceId, cfs);
  dataCache.invalidate(instanceId);
  appLogger.info("Custom Format preferences updated", {
    // TODO:  sources should be from LogSource enum
    source: "preferences-route",
    context: { instanceId, count: cfs.length },
  });
  return NextResponse.json({ ok: true });
});
