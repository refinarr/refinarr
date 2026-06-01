import { cn } from "@/client/lib/utils";
import { CfScoreList } from "@/client/components/common/CfScoreList";
import { SeverityDot } from "@/client/components/common/SeverityDot";
import type { MediaListShellRenderCtx } from "@/client/components/media/MediaListShell";
import { formatBytes } from "@/client/lib/format";
import { getSeverity, severityTextClass } from "@/client/lib/severity";
import { ISSUES_FOR, SCORE_FOR, isProfileMode } from "@/shared/scoring-mode";
import type { SeriesItem } from "@/shared/types/models";

interface Props {
  item: SeriesItem;
  ctx: MediaListShellRenderCtx<SeriesItem>;
}

export function SeriesCard({ item, ctx }: Props) {
  const { scoringMode, t } = ctx;
  const score = SCORE_FOR[scoringMode](item);
  const hasFile = item.episodeFiles.length > 0;
  const issues = ISSUES_FOR[scoringMode](item);
  const profile = isProfileMode(scoringMode);
  const severity = getSeverity(
    score,
    item.minProfileScore,
    scoringMode,
    hasFile,
  );
  const noFileScore = profile && !hasFile;
  let scoreText: string;
  if (noFileScore) scoreText = t("noFile");
  else if (item.minProfileScore !== undefined)
    scoreText = `${score} / ${item.minProfileScore}`;
  else scoreText = `${Math.round(score * 100)}%`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          <SeverityDot severity={severity} />
          <span className="truncate font-medium">{item.title}</span>
          <span className="text-muted-foreground shrink-0 text-xs">
            {item.year}
          </span>
        </div>
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
        <span className="tabular-nums">
          {t("episodeCountShort", {
            affected: item.affectedEpisodeCount,
            total: item.totalEpisodeCount,
          })}
        </span>
      </div>
      {issues.length > 0 && (
        <CfScoreList
          formats={profile ? issues : []}
          missingFormats={profile ? [] : issues}
        />
      )}
    </div>
  );
}
