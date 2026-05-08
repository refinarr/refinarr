import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { logRepository } from "@/server/repositories/LogRepository";
import { searchQueueRepository } from "@/server/repositories/SearchQueueRepository";
import type {
  ActionLog,
  ActionStatus,
  ActionType,
  SearchQueueAction,
  SearchQueueEntry,
} from "@/shared/types/models";

// Map a SearchQueue action key to the ActionLog action type. Both vocabularies
// describe the same concept; the queue uses a narrower per-arr taxonomy
// because it dispatches via per-action workers, while ActionLog uses the
// public action enum for retry / display.
const QUEUE_ACTION_TO_LOG: Record<SearchQueueAction, ActionType> = {
  movie: "search",
  series: "search",
  season: "search_season",
  episode: "search_episode",
};

// Pending queue rows synthesize as ActionLog-shaped objects with
// status="pending". Negative ids keep them disjoint from real ActionLog
// rows so React keys / retry logic never accidentally match them. Once
// the worker drains, the queue row flips to "done" and a real ActionLog
// row supersedes it — the synthetic disappears on the next refetch.
function syntheticFromQueue(row: SearchQueueEntry): ActionLog {
  return {
    id: -row.id,
    instanceId: row.instanceId,
    action: QUEUE_ACTION_TO_LOG[row.action],
    mediaId: row.mediaId,
    title: row.title,
    isDryRun: false,
    status: "pending",
    error: null,
    payload: null,
    groupId: row.groupId,
    commandId: null,
    completionMessage: null,
    createdAt: row.createdAt,
    lastRetriedAt: null,
  };
}

export const GET = createApiHandler(async (req: NextRequest) => {
  const s = req.nextUrl.searchParams;
  const instanceId = s.has("instanceId")
    ? Number(s.get("instanceId"))
    : undefined;
  const status = (s.get("status") ?? undefined) as ActionStatus | undefined;
  const action = (s.get("action") ?? undefined) as ActionType | undefined;
  const page = Number(s.get("page") ?? "1");
  const limit = Number(s.get("limit") ?? "50");

  const { items: actionLogs, total } = await logRepository.findPaginated(
    { instanceId, status, action },
    page,
    limit,
  );

  // Synthesize pending queue rows so a freshly-submitted bulk action is
  // visible in /history immediately, instead of trickling in as the
  // worker drains at the rate-limited cadence. Only on page 1 — pending
  // rows are typically few (capped by the rate limit and the user's
  // current submissions) and always belong at the top of the timeline
  // by createdAt; they don't paginate meaningfully.
  let pendingSynthetics: ActionLog[] = [];
  if (
    page === 1 &&
    (!status || status === "pending") &&
    (!action ||
      action === "search" ||
      action === "search_season" ||
      action === "search_episode")
  ) {
    const pending = instanceId
      ? await searchQueueRepository.findPendingByInstance(instanceId)
      : await searchQueueRepository.findAllPending();
    pendingSynthetics = pending
      .map(syntheticFromQueue)
      .filter((row) => !action || row.action === action);
  }

  // Merge + sort: most-recent createdAt first. Pending rows generally
  // have the freshest createdAt (just enqueued), so they naturally land
  // at the top.
  const merged = [...pendingSynthetics, ...actionLogs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return NextResponse.json({
    items: merged,
    total: total + pendingSynthetics.length,
    page,
    limit,
    hasMore: page * limit < total,
  });
});

export const DELETE = createApiHandler(async () => {
  await logRepository.clearAll();
  return NextResponse.json({ ok: true });
});
