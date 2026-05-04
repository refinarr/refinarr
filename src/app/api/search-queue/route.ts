import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { searchQueueService } from "@/server/services/SearchQueueService";

export const GET = createApiHandler(async (req: NextRequest) => {
  const instanceIdRaw = req.nextUrl.searchParams.get("instanceId");
  if (instanceIdRaw === null) {
    // No instanceId → return all pending rows across all instances. Used by
    // the queue inspector page; per-instance status (count/ETA) still goes
    // through ?instanceId=N below.
    const items = await searchQueueService.listAllPending();
    return NextResponse.json({ items });
  }
  const instanceId = Number(instanceIdRaw);
  if (!Number.isInteger(instanceId) || instanceId <= 0) {
    return NextResponse.json({ error: "instanceId required" }, { status: 400 });
  }
  const status = await searchQueueService.getStatus(instanceId);
  const items = await searchQueueService.listPending(instanceId);
  return NextResponse.json({ ...status, items });
});

export const DELETE = createApiHandler(async (req: NextRequest) => {
  const instanceIdRaw = req.nextUrl.searchParams.get("instanceId");
  const instanceId = Number(instanceIdRaw);
  if (!Number.isInteger(instanceId) || instanceId <= 0) {
    return NextResponse.json({ error: "instanceId required" }, { status: 400 });
  }
  const removed = await searchQueueService.clearPending(instanceId);
  return NextResponse.json({ removed });
});
