import { CfBadge } from "@/client/components/common/CfBadge";
import { ScoreLabel } from "@/client/components/common/ScoreLabel";
import { SeverityDot } from "@/client/components/common/SeverityDot";
import type { MediaListShellRenderCtx } from "@/client/components/media/MediaListShell";
import { formatBytes } from "@/client/lib/format";
import { getSeverity } from "@/client/lib/severity";
import type { FlaggedSeries } from "@/shared/types/models";

interface Props {
  item: FlaggedSeries;
  ctx: MediaListShellRenderCtx<FlaggedSeries>;
}

export function SeriesCard({ item, ctx }: Props) {
  const { scoringMode, t } = ctx;
  const score = scoringMode === "profile" ? item.customFormatScore : item.cfScore;
  const hasFile = item.episodeFiles.length > 0;
  const issues = scoringMode === "profile" ? item.unwantedFormats : item.missingFormats;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 min-w-0">
        <SeverityDot severity={getSeverity(score, item.minProfileScore, scoringMode, hasFile)} />
        <span className="font-medium truncate">{item.title}</span>
        <span className="text-muted-foreground text-xs shrink-0">{item.year}</span>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {scoringMode === "profile" && !hasFile ? (
          <span>{t("noFile")}</span>
        ) : (
          <ScoreLabel score={score} minProfileScore={item.minProfileScore} />
        )}
        <span className="tabular-nums">{formatBytes(item.sizeOnDisk)}</span>
        <span className="tabular-nums">{item.affectedEpisodeCount}/{item.totalEpisodeCount} ep</span>
      </div>
      {issues.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-0.5">
          {issues.slice(0, 3).map((cf) => <CfBadge key={cf.id} name={cf.name} missing />)}
          {issues.length > 3 && (
            <span className="text-xs text-muted-foreground">+{issues.length - 3}</span>
          )}
        </div>
      )}
    </div>
  );
}
