import { CfScoreList } from "@/client/components/common/CfScoreList";
import { ScoreLabel } from "@/client/components/common/ScoreLabel";
import { SearchStatusBadge } from "@/client/components/media/SearchStatusBadge";
import { SeverityDot } from "@/client/components/common/SeverityDot";
import type { MediaListShellRenderCtx } from "@/client/components/media/MediaListShell";
import { formatBytes } from "@/client/lib/format";
import { formatRelative } from "@/client/lib/format-relative";
import { getSeverity } from "@/client/lib/severity";
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

  return (
    <div className="space-y-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <SeverityDot
          severity={getSeverity(
            score,
            item.minProfileScore,
            scoringMode,
            item.hasFile,
          )}
        />
        <span className="truncate font-medium">{item.title}</span>
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
      <div className="text-muted-foreground flex items-center gap-3 text-xs">
        {profile && !item.hasFile ? (
          <span>{t("noFile")}</span>
        ) : (
          <ScoreLabel score={score} minProfileScore={item.minProfileScore} />
        )}
        <span className="tabular-nums">{formatBytes(item.sizeOnDisk)}</span>
      </div>
      {/* CF detail: show the flagged formats WITH their scores (profile
          penalties render as "name −X" in red; manual missing render
          line-through), via the shared list's wrap + collapse — richer
          than the old name-only badges capped at 3. */}
      {issues.length > 0 && (
        <CfScoreList
          formats={profile ? issues : []}
          missingFormats={profile ? [] : issues}
        />
      )}
    </div>
  );
}
