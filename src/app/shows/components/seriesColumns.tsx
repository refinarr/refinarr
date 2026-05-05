import { CfBadge } from "@/client/components/common/CfBadge";
import { ScoreLabel } from "@/client/components/common/ScoreLabel";
import { SearchStatusBadge } from "@/client/components/media/SearchStatusBadge";
import { SeverityDot } from "@/client/components/common/SeverityDot";
import type { ColumnDef } from "@/client/components/media/MediaTable";
import type { MediaListShellRenderCtx } from "@/client/components/media/MediaListShell";
import { formatBytes } from "@/client/lib/format";
import { formatRelative } from "@/client/lib/format-relative";
import { getSeverity } from "@/client/lib/severity";
import { ISSUES_FOR, ISSUES_HEADER_KEY, SCORE_FOR, isProfileMode } from "@/shared/scoring-mode";
import type { FlaggedSeries } from "@/shared/types/models";

export function seriesColumns(
  ctx: MediaListShellRenderCtx<FlaggedSeries>,
): ColumnDef<FlaggedSeries>[] {
  const { scoringMode, profiles, queuedIds, recentMap, activeInstance, t, tCols, tTime } = ctx;

  return [
    {
      key: "severity",
      header: "",
      className: "w-8",
      render: (s) => {
        const score = SCORE_FOR[scoringMode](s);
        const hasFile = s.episodeFiles.length > 0;
        return <SeverityDot severity={getSeverity(score, s.minProfileScore, scoringMode, hasFile)} />;
      },
    },
    {
      key: "title",
      header: tCols("title"),
      sortKey: "title",
      render: (s) => {
        const recent = !queuedIds.has(s.id) ? recentMap.get(s.id) : undefined;
        return (
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="font-medium truncate">{s.title}</span>
            <span className="text-muted-foreground text-xs shrink-0">{s.year}</span>
            {queuedIds.has(s.id) && (
              <SearchStatusBadge status="pending" instanceId={activeInstance} />
            )}
            {recent && (
              <SearchStatusBadge
                status="searched"
                instanceId={activeInstance}
                title={s.title}
                relativeTime={formatRelative(recent, tTime)}
              />
            )}
          </div>
        );
      },
    },
    {
      key: "profile",
      header: tCols("profile"),
      className: "w-32 text-muted-foreground",
      render: (s) => (
        <span className="truncate text-xs">
          {profiles?.find((p) => p.id === s.qualityProfileId)?.name ?? "—"}
        </span>
      ),
    },
    {
      key: "score",
      header: tCols("score"),
      sortKey: "score",
      className: "w-36 whitespace-nowrap",
      render: (s) => {
        if (isProfileMode(scoringMode) && s.episodeFiles.length === 0) {
          return <span className="text-xs text-muted-foreground">{t("noFile")}</span>;
        }
        return (
          <ScoreLabel
            score={SCORE_FOR[scoringMode](s)}
            minProfileScore={s.minProfileScore}
          />
        );
      },
    },
    {
      key: "size",
      header: tCols("size"),
      sortKey: "size",
      className: "w-24 text-xs text-muted-foreground tabular-nums whitespace-nowrap",
      render: (s) => formatBytes(s.sizeOnDisk),
    },
    {
      key: "episodes",
      header: tCols("episodes"),
      className: "w-20 text-xs text-muted-foreground tabular-nums",
      render: (s) => `${s.affectedEpisodeCount} / ${s.totalEpisodeCount}`,
    },
    {
      key: "issues",
      header: tCols(ISSUES_HEADER_KEY[scoringMode]),
      render: (s) => {
        const items = ISSUES_FOR[scoringMode](s);
        if (!items.length) return null;
        return (
          <div className="flex flex-wrap gap-1">
            {items.slice(0, 3).map((cf) => (
              <CfBadge key={cf.id} name={cf.name} missing />
            ))}
            {items.length > 3 && (
              <span className="text-xs text-muted-foreground">+{items.length - 3}</span>
            )}
          </div>
        );
      },
    },
  ];
}
