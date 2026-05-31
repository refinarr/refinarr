import { NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { autoRunner } from "@/server/lib/auto-runner";
import {
  HttpError,
  conflict,
  notFound,
  positiveInt,
} from "@/server/lib/api-errors";
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
    if (err instanceof Error && isUpstreamArrFailure(err)) {
      throw new HttpError({
        status: 502,
        message: "Upstream Arr unreachable",
        code: "ARR_UNREACHABLE",
        expose: true,
        context: { instanceId: id },
      });
    }
    throw err;
  }
});

function isUpstreamArrFailure(err: Error): boolean {
  const messages = [err.message];
  const cause = (err as Error & { cause?: unknown }).cause;
  if (cause instanceof Error) messages.push(cause.message);
  const code =
    (err as Error & { code?: string }).code ??
    (cause instanceof Error
      ? (cause as Error & { code?: string }).code
      : undefined);

  if (
    code &&
    [
      "ABORT_ERR",
      "ECONNREFUSED",
      "EAI_AGAIN",
      "ENOTFOUND",
      "ETIMEDOUT",
    ].includes(code)
  ) {
    return true;
  }

  return messages.some((message) =>
    /fetch failed|timeout|api error: 5\d\d/i.test(message),
  );
}
