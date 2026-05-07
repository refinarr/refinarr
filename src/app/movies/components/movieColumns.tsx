import { CfBadge } from "@/client/components/common/CfBadge";
import { ScoreLabel } from "@/client/components/common/ScoreLabel";
import { CfColumnFunnel } from "@/client/components/media/CfColumnFunnel";
import { ProfileColumnFunnel } from "@/client/components/media/ProfileColumnFunnel";
import { ScoreColumnFunnel } from "@/client/components/media/ScoreColumnFunnel";
import { SearchStatusBadge } from "@/client/components/media/SearchStatusBadge";
import { SeverityColumnFunnel } from "@/client/components/media/SeverityColumnFunnel";
import { SeverityDot } from "@/client/components/common/SeverityDot";
import { SizeColumnFunnel } from "@/client/components/media/SizeColumnFunnel";
import type { ColumnDef } from "@/client/components/media/MediaTable";
import type { MediaListShellRenderCtx } from "@/client/components/media/MediaListShell";
import { formatBytes } from "@/client/lib/format";
import { formatRelative } from "@/client/lib/format-relative";
import { getSeverity } from "@/client/lib/severity";
import {
  ISSUES_FOR,
  ISSUES_HEADER_KEY,
  SCORE_FOR,
  isManualMode,
  isProfileMode,
} from "@/shared/scoring-mode";
import type { MovieItem } from "@/shared/types/models";

export function movieColumns(
  ctx: MediaListShellRenderCtx<MovieItem>,
): ColumnDef<MovieItem>[] {
  const {
    scoringMode,
    profiles,
    queuedIds,
    recentMap,
    activeInstance,
    filters,
    onFilterChange,
    cfOptions,
    t,
    tCols,
    tTime,
  } = ctx;
  const issuesHeaderLabel = tCols(ISSUES_HEADER_KEY[scoringMode]);
  const profileHeaderLabel = tCols("profile");
  const scoreHeaderLabel = tCols("score");
  const sizeHeaderLabel = tCols("size");
  const cfFunnelOptions = isManualMode(scoringMode)
    ? cfOptions.missing
    : cfOptions.penalty;

  const renderSearchBadge = (id: number, title: string) => {
    if (queuedIds.has(id))
      return <SearchStatusBadge status="pending" instanceId={activeInstance} />;
    const recent = recentMap.get(id);
    if (recent) {
      return (
        <SearchStatusBadge
          status="searched"
          instanceId={activeInstance}
          title={title}
          relativeTime={formatRelative(recent, tTime)}
        />
      );
    }
    return null;
  };

  return [
    {
      key: "severity",
      header: <span className="sr-only">{tCols("severity")}</span>,
      className: "w-8",
      filter: (
        <SeverityColumnFunnel
          filters={filters}
          onChange={onFilterChange}
          columnLabel={tCols("severity")}
        />
      ),
      render: (m) => {
        const score = SCORE_FOR[scoringMode](m);
        return (
          <SeverityDot
            severity={getSeverity(
              score,
              m.minProfileScore,
              scoringMode,
              m.hasFile,
            )}
          />
        );
      },
    },
    {
      key: "title",
      header: tCols("title"),
      sortKey: "title",
      render: (m) => (
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="truncate font-medium">{m.title}</span>
          <span className="text-muted-foreground shrink-0 text-xs">
            {m.year}
          </span>
          {renderSearchBadge(m.id, m.title)}
        </div>
      ),
    },
    {
      key: "profile",
      header: profileHeaderLabel,
      className: "w-36 text-muted-foreground",
      filter: (
        <ProfileColumnFunnel
          profiles={profiles}
          filters={filters}
          onChange={onFilterChange}
          columnLabel={profileHeaderLabel}
        />
      ),
      render: (m) => (
        <span className="truncate text-xs">
          {profiles?.find((p) => p.id === m.qualityProfileId)?.name ?? "—"}
        </span>
      ),
    },
    {
      key: "score",
      header: scoreHeaderLabel,
      sortKey: "score",
      className: "w-36 whitespace-nowrap",
      filter: (
        <ScoreColumnFunnel
          scoringMode={scoringMode}
          filters={filters}
          onChange={onFilterChange}
          columnLabel={scoreHeaderLabel}
        />
      ),
      render: (m) => {
        if (isProfileMode(scoringMode) && !m.hasFile) {
          return (
            <span className="text-muted-foreground text-xs">{t("noFile")}</span>
          );
        }
        return (
          <ScoreLabel
            score={SCORE_FOR[scoringMode](m)}
            minProfileScore={m.minProfileScore}
          />
        );
      },
    },
    {
      key: "size",
      header: sizeHeaderLabel,
      sortKey: "size",
      className:
        "w-24 text-xs text-muted-foreground tabular-nums whitespace-nowrap",
      filter: (
        <SizeColumnFunnel
          filters={filters}
          onChange={onFilterChange}
          columnLabel={sizeHeaderLabel}
        />
      ),
      render: (m) => formatBytes(m.sizeOnDisk),
    },
    {
      key: "issues",
      header: issuesHeaderLabel,
      filter: (
        <CfColumnFunnel
          scoringMode={scoringMode}
          options={cfFunnelOptions}
          filters={filters}
          onChange={onFilterChange}
          columnLabel={issuesHeaderLabel}
        />
      ),
      render: (m) => {
        const items = ISSUES_FOR[scoringMode](m);
        if (!items.length) return null;
        return (
          <div className="flex flex-wrap gap-1">
            {items.slice(0, 3).map((cf) => (
              <CfBadge key={cf.id} name={cf.name} missing />
            ))}
            {items.length > 3 && (
              <span className="text-muted-foreground text-xs">
                +{items.length - 3}
              </span>
            )}
          </div>
        );
      },
    },
  ];
}
