import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { instanceRepository } from "@/server/repositories/InstanceRepository";
import { ArrClientFactory } from "@/server/clients/ArrClientFactory";
import { SonarrClient } from "@/server/clients/SonarrClient";

export const GET = createApiHandler(async (req: NextRequest) => {
  const instanceId = Number(req.nextUrl.searchParams.get("instanceId"));
  const instance = await instanceRepository.findById(instanceId);
  if (!instance)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const client = ArrClientFactory.createArrClient(instance) as SonarrClient;
  const profiles = await client.getQualityProfiles();
  return NextResponse.json(profiles);
});
