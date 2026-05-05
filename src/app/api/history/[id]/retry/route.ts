import { NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { logRepository } from "@/server/repositories/LogRepository";
import { instanceRepository } from "@/server/repositories/InstanceRepository";
import { mediaServiceFor, RetryNotSupportedError } from "@/server/services/media-services";
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

  // The log row's columns are the canonical record of what this entry
  // targets. If the JSON payload disagrees (corrupted or hand-edited),
  // refuse to retry — otherwise executeAction would run against a
  // different target and overwrite this row's history in place via the
  // actionLogId update path.
  if (
    payload.instanceId !== log.instanceId ||
    payload.mediaId !== log.mediaId ||
    payload.action !== log.action
  ) {
    throw badRequest("Stored payload no longer matches this log entry");
  }

  const inst = await instanceRepository.findById(payload.instanceId);
  if (!inst) throw notFound("Instance no longer exists");

  try {
    const result = await mediaServiceFor(inst.type).retryFromPayload(payload, { actionLogId: id });
    return NextResponse.json(result);
  } catch (err) {
    // User-correctable: the row's action isn't in this service's registry
    // (legacy or corrupt). Surface as 400 instead of letting the handler
    // log it as an unhandled 500.
    if (err instanceof RetryNotSupportedError) throw badRequest(err.message);
    throw err;
  }
});
