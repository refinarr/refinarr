import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { ignoreRepository } from "@/server/repositories/IgnoreRepository";
import { dataCache } from "@/server/lib/DataCache";

export const GET = createApiHandler(async (req: NextRequest) => {
  const instanceId = Number(req.nextUrl.searchParams.get("instanceId"));
  const entries = await ignoreRepository.findByInstance(instanceId);
  return NextResponse.json(entries);
});

export const POST = createApiHandler(async (req: NextRequest) => {
  const body = await req.json();
  const entry = await ignoreRepository.create(body);
  if (typeof body.instanceId === "number") dataCache.invalidate(body.instanceId);
  return NextResponse.json(entry, { status: 201 });
});
