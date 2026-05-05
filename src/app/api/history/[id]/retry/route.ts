import { NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { logRepository } from "@/server/repositories/LogRepository";
import { instanceRepository } from "@/server/repositories/InstanceRepository";
import { mediaServiceFor } from "@/server/services/media-services";

export const POST = createApiHandler(async (_req, ctx) => {
  const id = Number(ctx.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const log = await logRepository.findById(id);
  if (!log || !log.payload) {
    return NextResponse.json({ error: "Log entry not found or has no payload" }, { status: 404 });
  }

  const payload = JSON.parse(log.payload) as Record<string, unknown>;
  const instanceId = payload.instanceId as number;
  const inst = await instanceRepository.findById(instanceId);
  if (!inst) {
    return NextResponse.json({ error: "Instance no longer exists" }, { status: 404 });
  }

  try {
    const result = await mediaServiceFor(inst.type).retryFromPayload(payload);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cannot retry this action type" },
      { status: 400 },
    );
  }
});
