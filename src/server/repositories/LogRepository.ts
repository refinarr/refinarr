import type {
  ActionLog,
  ActionStatus,
  ActionType,
} from "@/shared/types/models";
import type { GroupSummary } from "@/shared/types/api";
import { BaseRepository } from "./BaseRepository";

const RETENTION_CAP = Number(process.env.ACTION_LOG_RETENTION_CAP) || 5000;

interface LogFilter {
  instanceId?: number;
  status?: ActionStatus;
  action?: ActionType;
}

class LogRepository extends BaseRepository<ActionLog> {
  async findById(id: number): Promise<ActionLog | null> {
    return this.db.actionLog.findUnique({
      where: { id },
    }) as Promise<ActionLog | null>;
  }

  async findAll(): Promise<ActionLog[]> {
    return this.db.actionLog.findMany({
      orderBy: [
        { lastRetriedAt: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ],
    }) as Promise<ActionLog[]>;
  }

  async findPaginated(
    filter: LogFilter,
    page: number,
    limit: number,
  ): Promise<{ items: ActionLog[]; total: number }> {
    const where = {
      ...(filter.instanceId ? { instanceId: filter.instanceId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.action ? { action: filter.action } : {}),
    };

    const [items, total] = await Promise.all([
      this.db.actionLog.findMany({
        where,
        orderBy: [
          { lastRetriedAt: { sort: "desc", nulls: "last" } },
          { createdAt: "desc" },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.actionLog.count({ where }),
    ]);

    return { items: items as ActionLog[], total };
  }

  async findFailedByInstance(instanceId: number): Promise<ActionLog[]> {
    return this.db.actionLog.findMany({
      where: { instanceId, status: "failed" },
      orderBy: [
        { lastRetriedAt: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ],
    }) as Promise<ActionLog[]>;
  }

  async countByStatusSince(status: ActionStatus, since: Date): Promise<number> {
    return this.db.actionLog.count({
      where: { status, createdAt: { gte: since } },
    });
  }

  // Feeds the dashboard "recent activity" list, which only renders
  // id/instance/media/title/status/action/timestamps. Projecting away the
  // heavy fields (payload retry-snapshots, error/stack text, completion +
  // grabbed-release strings) keeps the dashboard summary payload lean —
  // those columns can dwarf the rendered ones. The omitted fields are all
  // optional on ActionLog, so the cast stays sound.
  async findRecent(limit: number): Promise<ActionLog[]> {
    return this.db.actionLog.findMany({
      orderBy: [
        { lastRetriedAt: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ],
      take: limit,
      select: {
        id: true,
        instanceId: true,
        action: true,
        mediaId: true,
        title: true,
        status: true,
        isDryRun: true,
        createdAt: true,
        lastRetriedAt: true,
      },
    }) as Promise<ActionLog[]>;
  }

  /**
   * Per-instance summary used by the "Searched Xm ago" badge: for each
   * mediaId that had a successful search action within `windowMs`, the
   * timestamp of its most recent search. Returned ordered by most
   * recent first so callers that build a Map<mediaId, Date> get the
   * latest entry.
   *
   * Status floor accepts every post-dispatch state — the badge is about
   * "you sent a search recently", not "did anything come of it." A row
   * that has progressed to grabbed/downloaded was still searched.
   */
  async findRecentSearches(
    instanceId: number,
    windowMs: number,
  ): Promise<Array<{ mediaId: number; lastSearchedAt: Date }>> {
    const since = new Date(Date.now() - windowMs);
    const rows = await this.db.actionLog.findMany({
      where: {
        instanceId,
        action: "search",
        status: { in: ["searched", "grabbed", "downloaded"] },
        isDryRun: false,
        // A retry that succeeded counts as a recent search even if the
        // original row was created outside the window.
        OR: [{ createdAt: { gte: since } }, { lastRetriedAt: { gte: since } }],
      },
      select: { mediaId: true, createdAt: true, lastRetriedAt: true },
    });
    // We need max(lastRetriedAt ?? createdAt) per mediaId — the multi-key
    // sort would put any retried row ahead of any non-retried one, so an
    // older retried success could mask a newer plain success. Compute the
    // max in code instead.
    const seen = new Map<number, Date>();
    for (const r of rows) {
      const at = r.lastRetriedAt ?? r.createdAt;
      const prev = seen.get(r.mediaId);
      if (!prev || at.getTime() > prev.getTime()) seen.set(r.mediaId, at);
    }
    return [...seen.entries()]
      .map(([mediaId, lastSearchedAt]) => ({ mediaId, lastSearchedAt }))
      .sort((a, b) => b.lastSearchedAt.getTime() - a.lastSearchedAt.getTime());
  }

  /**
   * Command sync — rows with a non-null commandId that the
   * statusPoller might still need to update. Filter to a rolling time
   * window so an instance that's been quiet for days doesn't return a
   * huge backlog. Status floor is "searched" or "grabbed" — terminal
   * states (failed, downloaded, dry_run) are excluded so we don't
   * re-process completed work.
   *
   * Two open lanes:
   *   - status="searched" AND completionMessage IS NULL: command-sync
   *     hasn't observed the outcome yet. Keep polling until it stamps.
   *   - status="grabbed": always keep. Either the synthesized
   *     "No releases grabbed" message is stale (history-sync moved
   *     the row past 'searched' after the synthesis fired) and needs
   *     healing on the next command-sync tick, OR the row reached
   *     'grabbed' without command-sync ever observing the command
   *     completion and still needs to.
   *
   * Excludes "searched" rows whose completionMessage is already
   * stamped — those have nothing more for command-sync to do; future
   * state transitions are driven by history-sync which doesn't read
   * this query. Without that branch the poller re-fetched the same
   * /command/{id} every tick for 24h.
   */
  async findOpenCommandsByInstance(
    instanceId: number,
    sinceMs: number,
  ): Promise<ActionLog[]> {
    const since = new Date(Date.now() - sinceMs);
    return this.db.actionLog.findMany({
      where: {
        instanceId,
        commandId: { not: null },
        createdAt: { gte: since },
        OR: [
          { status: "searched", completionMessage: null },
          { status: "grabbed" },
        ],
      },
      orderBy: { createdAt: "desc" },
    }) as Promise<ActionLog[]>;
  }

  /**
   * History sync — most-recent ActionLog row matching a media event
   * coming in from /history. Fuzzy match (instance, mediaId, action,
   * status floor, time window) since upstream history doesn't carry
   * commandId. ORDER BY createdAt DESC LIMIT 1 means the freshest
   * matching row wins; older rows at the same media/action only get
   * touched if the freshest is missing for some reason.
   */
  async findCorrelatableByMedia(args: {
    instanceId: number;
    mediaId: number;
    actions: ActionType[];
    statusFloor: ActionStatus[];
    sinceMs: number;
  }): Promise<ActionLog | null> {
    const since = new Date(Date.now() - args.sinceMs);
    return this.db.actionLog.findFirst({
      where: {
        instanceId: args.instanceId,
        mediaId: args.mediaId,
        action: { in: args.actions },
        status: { in: args.statusFloor },
        isDryRun: false,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
    }) as Promise<ActionLog | null>;
  }

  async findLastSearchedAtByMedia(
    instanceId: number,
  ): Promise<Map<number, { at: Date; failed: boolean }>> {
    const rows = await this.db.actionLog.findMany({
      where: {
        instanceId,
        action: { startsWith: "search" },
      },
      select: {
        mediaId: true,
        createdAt: true,
        lastRetriedAt: true,
        status: true,
      },
    });
    const map = new Map<number, { at: Date; failed: boolean }>();
    for (const r of rows) {
      const at = r.lastRetriedAt ?? r.createdAt;
      const prev = map.get(r.mediaId);
      if (!prev || at.getTime() > prev.at.getTime())
        map.set(r.mediaId, { at, failed: r.status === "failed" });
    }
    return map;
  }

  /**
   * Media that already have a search in flight — a non-dry-run row at
   * `searched` or `grabbed` created within `sinceMs`. The auto-runner
   * uses this to avoid re-enqueuing a movie/series whose prior search
   * hasn't resolved to `downloaded`/`failed` yet (#39): the lifecycle
   * poller advances one row per media, so without this gate a still-
   * flagged item (grabbed but not yet imported) gets re-searched every
   * tick, multiplying upstream load and burying the grab transition
   * under fresh `searched` rows. The `sinceMs` bound self-heals a row
   * the poller never resolved — past the window the media is eligible
   * again instead of being gated forever.
   */
  async findInFlightMediaIds(
    instanceId: number,
    sinceMs: number,
  ): Promise<Set<number>> {
    const since = new Date(Date.now() - sinceMs);
    const rows = await this.db.actionLog.findMany({
      where: {
        instanceId,
        isDryRun: false,
        status: { in: ["searched", "grabbed"] },
        // A retried search is in flight regardless of when the original
        // row was created — gate on either timestamp so a retry of an
        // old failed row isn't re-enqueued underneath the in-flight retry.
        OR: [{ createdAt: { gte: since } }, { lastRetriedAt: { gte: since } }],
      },
      select: { mediaId: true },
    });
    return new Set(rows.map((r) => r.mediaId));
  }

  /**
   * Per-group aggregate counts for the History batch header. Returns one
   * entry per requested groupId that has any matching ActionLog row;
   * groupIds with zero matches are omitted (caller can detect that and
   * still surface synthetic queue-only rows separately).
   *
   * Two queries: one groupBy(status) for the counts, one distinct(action)
   * because Prisma's groupBy doesn't combine aggregation + distinct cleanly.
   * Both are indexed on `groupId` (via the partial index on ActionLog),
   * so scan cost stays per-group, not per-instance.
   */
  async findGroupSummaries(
    groupIds: string[],
  ): Promise<Record<string, GroupSummary>> {
    if (groupIds.length === 0) return {};
    const [statusGroups, actionPerGroup] = await Promise.all([
      this.db.actionLog.groupBy({
        by: ["groupId", "status"],
        where: { groupId: { in: groupIds } },
        _count: { _all: true },
      }),
      this.db.actionLog.findMany({
        where: { groupId: { in: groupIds } },
        distinct: ["groupId"],
        select: { groupId: true, action: true },
      }),
    ]);

    // The `where: { groupId: { in: groupIds } }` filter excludes null
    // groupIds from both queries, so every row here has a non-null
    // groupId; assert that to TS with `as string` instead of branching
    // on it. Prisma's generated types keep `groupId` typed as nullable
    // regardless of the where clause, so the cast is the narrowing.
    // Same reasoning for `action as ActionType` and `status as
    // ActionStatus` — Prisma types those columns as bare strings, but
    // the union shapes are owned by `src/shared/types/models.ts` and
    // every writer (SearchDispatcher, retry route, auto-runner) goes
    // through that vocabulary. Runtime null-checks here would only
    // catch corruption from a direct DB-level INSERT bypassing our
    // writers, which isn't a threat model we cover.
    //
    // Fold both queries into one pass keyed by groupId. statusGroups
    // alone is enough to know which groupIds matter; actionPerGroup is
    // looked up lazily as a Map so a row in statusGroups without a
    // matching action (extremely unlikely in practice — both queries
    // run inside the same await — but possible across a race with a
    // delete) is skipped instead of throwing on undefined dereferencing.
    const actionByGroup = new Map(
      actionPerGroup.map((a) => [a.groupId as string, a.action as ActionType]),
    );
    const out: Record<string, GroupSummary> = {};
    for (const g of statusGroups) {
      const groupId = g.groupId as string;
      const action = actionByGroup.get(groupId);
      if (!action) continue;
      const summary =
        out[groupId] ??
        (out[groupId] = { groupId, total: 0, statusCounts: {}, action });
      const count = g._count._all;
      summary.statusCounts[g.status as ActionStatus] = count;
      summary.total += count;
    }
    return out;
  }

  async create(data: Omit<ActionLog, "id" | "createdAt">): Promise<ActionLog> {
    const created = (await this.db.actionLog.create({ data })) as ActionLog;
    void this.trim();
    return created;
  }

  async update(id: number, data: Partial<ActionLog>): Promise<ActionLog> {
    return this.db.actionLog.update({
      where: { id },
      data,
    }) as Promise<ActionLog>;
  }

  async delete(id: number): Promise<void> {
    await this.db.actionLog.delete({ where: { id } });
  }

  async clearAll(): Promise<void> {
    await this.db.actionLog.deleteMany({});
  }

  private async trim(): Promise<void> {
    const total = await this.db.actionLog.count();
    if (total <= RETENTION_CAP) return;
    const overflow = total - RETENTION_CAP;
    const oldest = await this.db.actionLog.findMany({
      orderBy: { createdAt: "asc" },
      take: overflow,
      select: { id: true },
    });
    await this.db.actionLog.deleteMany({
      where: { id: { in: oldest.map((e) => e.id) } },
    });
  }
}

export const logRepository = new LogRepository();
