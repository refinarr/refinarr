import { NextResponse } from "next/server";
import { notFound, positiveInt } from "@/server/lib/api-errors";
import { createApiHandler } from "@/server/lib/handler";
import { autoRunner, buildAutoSearchStatus } from "@/server/lib/auto-runner";
import { instanceRepository } from "@/server/repositories/InstanceRepository";

export const GET = createApiHandler(async (_req, ctx) => {
  const id = positiveInt(ctx.params.id, "id");
  const instance = await instanceRepository.findById(id);
  if (!instance) throw notFound();
  return NextResponse.json(
    buildAutoSearchStatus(instance, autoRunner.isRunning(id)),
  );
});
