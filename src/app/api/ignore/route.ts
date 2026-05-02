import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { ignoreRepository } from "@/server/repositories/IgnoreRepository";
import { dataCache } from "@/server/lib/DataCache";
import { ignoreCreateSchema } from "@/shared/types/schemas";

export const GET = createApiHandler(async (req: NextRequest) => {
  const instanceId = Number(req.nextUrl.searchParams.get("instanceId"));
  if (!Number.isInteger(instanceId) || instanceId <= 0) {
    return NextResponse.json({ error: "Invalid instanceId" }, { status: 400 });
  }
  const entries = await ignoreRepository.findByInstance(instanceId);
  return NextResponse.json(entries);
});

export const POST = createApiHandler(async (req: NextRequest) => {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = ignoreCreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid ignore entry" }, { status: 400 });
  const entry = await ignoreRepository.create(parsed.data);
  dataCache.invalidate(parsed.data.instanceId);
  return NextResponse.json(entry, { status: 201 });
});
