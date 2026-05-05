import { NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { logRepository } from "@/server/repositories/LogRepository";
import { instanceRepository } from "@/server/repositories/InstanceRepository";
import { mediaServiceFor } from "@/server/services/media-services";
import { retryPayloadSchema } from "@/shared/types/schemas";

export const POST = createApiHandler(async (_req, ctx) => {
  const id = Number(ctx.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const log = await logRepository.findById(id);
  if (!log || !log.payload) {
    return NextResponse.json({ error: "Log entry not found or has no payload" }, { status: 404 });
  }

  // The stored payload is JSON written by our own services, but it's still
  // user-influenceable (action title, media id) and survives across schema
  // changes. Validate the shape before reading instanceId so a corrupt or
  // older row can't redirect the retry to a bogus instance lookup.
  let raw: unknown;
  try {
    raw = JSON.parse(log.payload);
  } catch {
    return NextResponse.json({ error: "Stored payload is not valid JSON" }, { status: 400 });
  }
  const parsed = retryPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Stored payload has unexpected shape" }, { status: 400 });
  }
  const payload = parsed.data;

  const inst = await instanceRepository.findById(payload.instanceId);
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
