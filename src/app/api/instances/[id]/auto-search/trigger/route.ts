import { NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { autoRunner } from "@/server/lib/auto-runner";
import { conflict, notFound, positiveInt } from "@/server/lib/api-errors";
import { instanceRepository } from "@/server/repositories/InstanceRepository";

export const POST = createApiHandler(async (_req, ctx) => {
  const id = positiveInt(ctx.params.id, "id");
  const instance = await instanceRepository.findById(id);
  if (!instance) throw notFound();

  try {
    const result = await autoRunner.runNow(id);
    return NextResponse.json(result);
  } catch (err) {
    if (
      err instanceof Error &&
      (err as NodeJS.ErrnoException).code === "AUTO_RUN_BUSY"
    ) {
      throw conflict("Auto-search already running", "AUTO_RUN_BUSY");
    }
    if (
      err instanceof Error &&
      (err as NodeJS.ErrnoException).code === "AUTO_RUN_INELIGIBLE"
    ) {
      throw conflict(
        "Instance not eligible for auto-search",
        "AUTO_RUN_INELIGIBLE",
      );
    }
    throw err;
  }
});
