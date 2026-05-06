import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { notFound, positiveInt } from "@/server/lib/api-errors";
import { instanceRepository } from "@/server/repositories/InstanceRepository";
import { ArrClientFactory } from "@/server/clients/ArrClientFactory";

export const GET = createApiHandler(async (req: NextRequest) => {
  const instanceId = positiveInt(
    req.nextUrl.searchParams.get("instanceId") ?? undefined,
    "instanceId",
  );
  const instance = await instanceRepository.findById(instanceId);
  if (!instance) throw notFound("Instance not found");
  const client = ArrClientFactory.createArrClient(instance);
  const formats = await client.getCustomFormats();
  return NextResponse.json(formats);
});
