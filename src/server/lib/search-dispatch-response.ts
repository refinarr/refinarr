import { NextResponse } from "next/server";
import type { SearchDispatchResult } from "@/server/services/SearchDispatcher";
import type { QueuedSearchResponse } from "@/shared/types/api";

// Translate a SearchDispatchResult into the wire format the search routes
// have been returning since the queue worker landed:
//   - dry-run → 200 with the ActionLog row body (so the client can show the
//     "Dry run" toast and update the history table optimistically)
//   - queued → 202 with QueuedSearchResponse (the queue worker will write the
//     ActionLog later when it drains)
export function respondToSearchDispatch(
  result: SearchDispatchResult,
): NextResponse {
  if (result.kind === "dryRun") return NextResponse.json(result.actionLog);
  const body: QueuedSearchResponse = { queued: true, queueId: result.queueId };
  return NextResponse.json(body, { status: 202 });
}
