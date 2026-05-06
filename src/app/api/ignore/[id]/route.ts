import { NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { positiveInt } from "@/server/lib/api-errors";
import { ignoreRepository } from "@/server/repositories/IgnoreRepository";
import { dataCache } from "@/server/lib/DataCache";

export const DELETE = createApiHandler(async (_req, ctx) => {
  const id = positiveInt(ctx.params.id, "id");
  const entry = await ignoreRepository.findById(id);
  await ignoreRepository.delete(id);
  if (entry) dataCache.invalidate(entry.instanceId);
  return NextResponse.json({ ok: true });
});
