import { CfScoreList } from "@/client/components/common/CfScoreList";
import { ScoreLabel } from "@/client/components/common/ScoreLabel";
import { SeverityDot } from "@/client/components/common/SeverityDot";
import type { MediaListShellRenderCtx } from "@/client/components/media/MediaListShell";
import { formatBytes } from "@/client/lib/format";
import { getSeverity } from "@/client/lib/severity";
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

  return (
    <div className="space-y-2">
      <div className="flex min-w-0 items-center gap-2">
        <SeverityDot
          severity={getSeverity(
            score,
            item.minProfileScore,
            scoringMode,
            hasFile,
          )}
        />
        <span className="truncate font-medium">{item.title}</span>
        <span className="text-muted-foreground shrink-0 text-xs">
          {item.year}
        </span>
      </div>
      <div className="text-muted-foreground flex items-center gap-3 text-xs">
        {profile && !hasFile ? (
          <span>{t("noFile")}</span>
        ) : (
          <ScoreLabel score={score} minProfileScore={item.minProfileScore} />
        )}
        <span className="tabular-nums">{formatBytes(item.sizeOnDisk)}</span>
        <span className="tabular-nums">
          {t("episodeCountShort", {
            affected: item.affectedEpisodeCount,
            total: item.totalEpisodeCount,
          })}
        </span>
      </div>
      {/* CF detail with scores via the shared list (see MovieCard). */}
      {issues.length > 0 && (
        <CfScoreList
          formats={profile ? issues : []}
          missingFormats={profile ? [] : issues}
        />
      )}
    </div>
  );
}
