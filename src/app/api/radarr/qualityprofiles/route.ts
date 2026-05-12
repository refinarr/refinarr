import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { notFound, positiveInt } from "@/server/lib/api-errors";
import { instanceRepository } from "@/server/repositories/InstanceRepository";
import { createArrClient } from "@/server/arr/composition";
import { RadarrClient } from "@/server/clients/RadarrClient";

export const GET = createApiHandler(async (req: NextRequest) => {
  const instanceId = positiveInt(
    req.nextUrl.searchParams.get("instanceId") ?? undefined,
    "instanceId",
  );
  const instance = await instanceRepository.findById(instanceId);
  if (!instance) throw notFound("Instance not found");
  const client = createArrClient(instance) as RadarrClient;
  const profiles = await client.getQualityProfiles();
  return NextResponse.json(profiles);
});
