import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { preferenceRepository } from "@/server/repositories/PreferenceRepository";

export const GET = createApiHandler(async (req: NextRequest) => {
  const instanceId = Number(req.nextUrl.searchParams.get("instanceId"));
  const prefs = await preferenceRepository.findByInstance(instanceId);
  return NextResponse.json(prefs);
});

export const PUT = createApiHandler(async (req: NextRequest) => {
  const { instanceId, cfs } = await req.json();
  await preferenceRepository.setForInstance(instanceId, cfs);
  return NextResponse.json({ ok: true });
});
