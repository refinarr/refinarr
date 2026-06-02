import { useTranslations } from "next-intl";
import { cn } from "@/client/lib/utils";
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
  const tCommon = useTranslations("common");
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
      <div className="flex items-center gap-2">
        <SeverityDot severity={severity} />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="min-w-0 truncate font-medium">{item.title}</span>
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
      {/* Single meta line keeps every card exactly two rows tall →
          uniform height, so the virtualizer estimate is exact (no
          gap/overlap on fast scroll). The CF detail lives in the drawer. */}
      <div className="text-muted-foreground flex items-center gap-x-2 overflow-hidden text-xs">
        <span className="tabular-nums">{formatBytes(item.sizeOnDisk)}</span>
        <span className="shrink-0 tabular-nums">
          {t("episodeCountShort", {
            affected: item.affectedEpisodeCount,
            total: item.totalEpisodeCount,
          })}
        </span>
        {issues.length > 0 && (
          <span className="text-critical/90 shrink-0">
            {tCommon(profile ? "penaltyCount" : "missingCount", {
              count: issues.length,
            })}
          </span>
        )}
      </div>
    </div>
  );
}
