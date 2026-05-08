import { NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { positiveInt } from "@/server/lib/api-errors";
import { instanceService } from "@/server/services/InstanceService";
import { statusPoller } from "@/server/lib/status-poller";

export const POST = createApiHandler(async (_req, ctx) => {
  const id = positiveInt(ctx.params.id, "id");
  const ok = await instanceService.testConnection(id);
  // A successful Test from the UI signals "the user just confirmed
  // this instance is reachable" — kick the poller so it fires an
  // immediate tick instead of waiting up to one base interval.
  // Failed tests don't trigger refresh: there's no upstream state
  // worth fetching, and refresh() would just re-arm the same broken
  // poll cadence.
  if (ok) void statusPoller.refresh(id);
  return NextResponse.json({ ok });
});
