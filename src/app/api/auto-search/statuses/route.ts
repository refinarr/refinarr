import { NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { autoRunner, buildAutoSearchStatus } from "@/server/lib/auto-runner";
import { instanceRepository } from "@/server/repositories/InstanceRepository";
import type { AutoSearchStatus } from "@/shared/types/api";

export const GET = createApiHandler(async () => {
  const instances = await instanceRepository.findAllEnabled();
  const statuses: Record<number, AutoSearchStatus> = {};
  for (const instance of instances) {
    if (instance.autoSearchEnabled) {
      statuses[instance.id] = buildAutoSearchStatus(
        instance,
        autoRunner.isRunning(instance.id),
      );
    }
  }
  return NextResponse.json(statuses);
});
