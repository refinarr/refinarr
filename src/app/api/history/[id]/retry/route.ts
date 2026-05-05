import { NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { logRepository } from "@/server/repositories/LogRepository";
import { instanceRepository } from "@/server/repositories/InstanceRepository";
import { mediaServiceFor } from "@/server/services/media-services";
import { retryPayloadSchema } from "@/shared/types/schemas";
import { badRequest, notFound, positiveInt } from "@/server/lib/api-errors";

export const POST = createApiHandler(async (_req, ctx) => {
  const id = positiveInt(ctx.params.id, "id");

  const log = await logRepository.findById(id);
  if (!log || !log.payload) {
    throw notFound("Log entry not found or has no payload");
  }

  // The stored payload is JSON written by our own services, but it's still
  // user-influenceable (action title, media id) and survives across schema
  // changes. Validate the shape before reading instanceId so a corrupt or
  // older row can't redirect the retry to a bogus instance lookup.
  let raw: unknown;
  try {
    raw = JSON.parse(log.payload);
  } catch {
    throw badRequest("Stored payload is not valid JSON");
  }
  const parsed = retryPayloadSchema.safeParse(raw);
  if (!parsed.success) throw badRequest("Stored payload has unexpected shape");
  const payload = parsed.data;

  const inst = await instanceRepository.findById(payload.instanceId);
  if (!inst) throw notFound("Instance no longer exists");

  const result = await mediaServiceFor(inst.type).retryFromPayload(payload);
  return NextResponse.json(result);
});
