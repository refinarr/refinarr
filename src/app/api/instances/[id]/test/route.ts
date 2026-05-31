import { NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { notFound, positiveInt } from "@/server/lib/api-errors";
import { instanceService } from "@/server/services/InstanceService";
import { statusPoller } from "@/server/lib/status-poller";
import { appLogger } from "@/server/lib/app-logger";
import { LogSource } from "@/shared/types/models";

export const POST = createApiHandler(async (_req, ctx) => {
  const id = positiveInt(ctx.params.id, "id");
  // 404 for a nonexistent instance rather than a misleading {ok:false}.
  if (!(await instanceService.getById(id))) throw notFound();
  const ok = await instanceService.testConnection(id);
  // A successful Test from the UI signals "the user just confirmed
  // this instance is reachable" — kick the poller so it fires an
  // immediate tick instead of waiting up to one base interval.
  // Failed tests don't trigger refresh: there's no upstream state
  // worth fetching, and refresh() would just re-arm the same broken
  // poll cadence.
  if (ok) {
    // Fire-and-forget by design (we don't want the response blocked
    // on the poller). Attach a catch so a rejection inside refresh()
    // becomes a /logs entry instead of an unhandled rejection that
    // could crash the process under strict Node settings.
    statusPoller.refresh(id).catch((err: unknown) => {
      appLogger.warn("statusPoller.refresh failed after instance test", {
        source: LogSource.Api,
        err,
        context: { instanceId: id },
      });
    });
  }
  return NextResponse.json({ ok });
});
