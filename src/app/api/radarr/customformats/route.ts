import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { instanceRepository } from "@/server/repositories/InstanceRepository";
import { ArrClientFactory } from "@/server/clients/ArrClientFactory";

export const GET = createApiHandler(async (req: NextRequest) => {
  const instanceId = Number(req.nextUrl.searchParams.get("instanceId"));
  const instance = await instanceRepository.findById(instanceId);
  if (!instance)
    return NextResponse.json({ error: "Instance not found" }, { status: 404 });
  const client = ArrClientFactory.createArrClient(instance);
  const formats = await client.getCustomFormats();
  return NextResponse.json(formats);
});
