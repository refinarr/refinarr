import { NextResponse } from "next/server";
import type { SearchDispatchResult } from "@/server/services/SearchDispatcher";
import type { QueuedSearchResponse } from "@/shared/types/api";

// Search-route response: always 202 with QueuedSearchResponse. Manual
// searches go through the queue in BOTH live and dry-run mode now (the
// worker writes the dry_run ActionLog row when it drains), so the wire
// shape no longer needs to vary by mode. `isDryRun` is propagated so the
// client picks "Dry run" vs "Search started" toast.
export function respondToSearchDispatch(
  result: SearchDispatchResult,
): NextResponse {
  const body: QueuedSearchResponse = {
    queued: true,
    queueId: result.queueId,
    isDryRun: result.isDryRun,
  };
  return NextResponse.json(body, { status: 202 });
}
