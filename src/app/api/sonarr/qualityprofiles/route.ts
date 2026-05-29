import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { assertArrType, notFound, positiveInt } from "@/server/lib/api-errors";
import { instanceRepository } from "@/server/repositories/InstanceRepository";
import { createTypedClient } from "@/server/arr/composition";

export const GET = createApiHandler(async (req: NextRequest) => {
  const instanceId = positiveInt(
    req.nextUrl.searchParams.get("instanceId") ?? undefined,
    "instanceId",
  );
  const instance = await instanceRepository.findById(instanceId);
  if (!instance) throw notFound("Instance not found");
  assertArrType(instance, "sonarr");
  const client = createTypedClient(instance, "sonarr");
  const profiles = await client.getQualityProfiles();
  return NextResponse.json(profiles);
});
