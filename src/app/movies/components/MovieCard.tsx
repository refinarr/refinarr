import { CfBadge } from "@/client/components/common/CfBadge";
import { ScoreLabel } from "@/client/components/common/ScoreLabel";
import { SearchStatusBadge } from "@/client/components/media/SearchStatusBadge";
import { SeverityDot } from "@/client/components/common/SeverityDot";
import type { MediaListShellRenderCtx } from "@/client/components/media/MediaListShell";
import { formatBytes } from "@/client/lib/format";
import { formatRelative } from "@/client/lib/format-relative";
import { getSeverity } from "@/client/lib/severity";
import { ISSUES_FOR, SCORE_FOR, isProfileMode } from "@/shared/scoring-mode";
import type { FlaggedMovie } from "@/shared/types/models";

interface Props {
  item: FlaggedMovie;
  ctx: MediaListShellRenderCtx<FlaggedMovie>;
}

export function MovieCard({ item, ctx }: Props) {
  const { scoringMode, queuedIds, recentMap, activeInstance, t, tTime } = ctx;
  const score = SCORE_FOR[scoringMode](item);
  const issues = ISSUES_FOR[scoringMode](item);
  const recent = !queuedIds.has(item.id) ? recentMap.get(item.id) : undefined;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 min-w-0 flex-wrap">
        <SeverityDot severity={getSeverity(score, item.minProfileScore, scoringMode, item.hasFile)} />
        <span className="font-medium truncate">{item.title}</span>
        <span className="text-muted-foreground text-xs shrink-0">{item.year}</span>
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
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {isProfileMode(scoringMode) && !item.hasFile ? (
          <span>{t("noFile")}</span>
        ) : (
          <ScoreLabel score={score} minProfileScore={item.minProfileScore} />
        )}
        <span className="tabular-nums">{formatBytes(item.sizeOnDisk)}</span>
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
