import { NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { ignoreRepository } from "@/server/repositories/IgnoreRepository";

export const DELETE = createApiHandler(async (_req, ctx) => {
  const id = Number(ctx.params.id);
  await ignoreRepository.delete(id);
  return NextResponse.json({ ok: true });
});
