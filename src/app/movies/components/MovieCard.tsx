import { cn } from "@/client/lib/utils";
import { CfScoreList } from "@/client/components/common/CfScoreList";
import { SearchStatusBadge } from "@/client/components/media/SearchStatusBadge";
import { SeverityDot } from "@/client/components/common/SeverityDot";
import type { MediaListShellRenderCtx } from "@/client/components/media/MediaListShell";
import { formatBytes } from "@/client/lib/format";
import { formatRelative } from "@/client/lib/format-relative";
import { getSeverity, severityTextClass } from "@/client/lib/severity";
import { ISSUES_FOR, SCORE_FOR, isProfileMode } from "@/shared/scoring-mode";
import type { MovieItem } from "@/shared/types/models";

interface Props {
  item: MovieItem;
  ctx: MediaListShellRenderCtx<MovieItem>;
}

export function MovieCard({ item, ctx }: Props) {
  const { scoringMode, queuedIds, recentMap, activeInstance, t, tTime } = ctx;
  const score = SCORE_FOR[scoringMode](item);
  const issues = ISSUES_FOR[scoringMode](item);
  const recent = !queuedIds.has(item.id) ? recentMap.get(item.id) : undefined;
  const profile = isProfileMode(scoringMode);
  const severity = getSeverity(
    score,
    item.minProfileScore,
    scoringMode,
    item.hasFile,
  );
  const noFileScore = profile && !item.hasFile;
  let scoreText: string;
  if (noFileScore) scoreText = t("noFile");
  else if (item.minProfileScore !== undefined)
    scoreText = `${score} / ${item.minProfileScore}`;
  else scoreText = `${Math.round(score * 100)}%`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <SeverityDot severity={severity} />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="min-w-0 truncate font-medium">{item.title}</span>
          <span className="text-muted-foreground shrink-0 text-xs">
            {item.year}
          </span>
          {queuedIds.has(item.id) && (
            <SearchStatusBadge status="pending" instanceId={activeInstance} />
          )}
          {recent && (
            <SearchStatusBadge
              status="searched"
              instanceId={activeInstance}
              title={item.title}
              relativeTime={formatRelative(recent, tTime)}
            />
          )}
        </div>
        {/* Prominent, severity-colored score — the card's key metric. */}
        <span
          className={cn(
            "shrink-0 text-sm font-semibold tabular-nums",
            severityTextClass[severity],
          )}
        >
          {scoreText}
        </span>
      </div>
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
        <span className="tabular-nums">{formatBytes(item.sizeOnDisk)}</span>
        {!profile && !item.hasFile && <span>{t("noFile")}</span>}
      </div>
      {issues.length > 0 && (
        <CfScoreList
          dense
          formats={profile ? issues : []}
          missingFormats={profile ? [] : issues}
        />
      )}
    </div>
  );
}
