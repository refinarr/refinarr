import { Eye, EyeOff } from "lucide-react";
import { CfBadge } from "@/client/components/common/CfBadge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/client/components/ui/popover";
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
import type { SeriesItem } from "@/shared/types/models";

export function seriesColumns(
  ctx: MediaListShellRenderCtx<SeriesItem>,
): ColumnDef<SeriesItem>[] {
  const {
    scoringMode,
    profiles,
    queuedIds,
    recentMap,
    activeInstance,
    density,
    filters,
    onFilterChange,
    cfOptions,
    t,
    tCols,
    tTime,
  } = ctx;
  const issuesVisible = density === "compact" ? 1 : 2;
  const issuesHeaderLabel = tCols(ISSUES_HEADER_KEY[scoringMode]);
  const profileHeaderLabel = tCols("profile");
  const scoreHeaderLabel = tCols("score");
  const sizeHeaderLabel = tCols("size");
  const cfFunnelOptions = isManualMode(scoringMode)
    ? cfOptions.missing
    : cfOptions.penalty;

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
      render: (s) => {
        const score = SCORE_FOR[scoringMode](s);
        const hasFile = s.episodeFiles.length > 0;
        return (
          <SeverityDot
            severity={getSeverity(
              score,
              s.minProfileScore,
              scoringMode,
              hasFile,
            )}
          />
        );
      },
    },
    {
      key: "title",
      header: tCols("title"),
      sortKey: "title",
      render: (s) => {
        const recent = !queuedIds.has(s.id) ? recentMap.get(s.id) : undefined;
        return (
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="truncate font-medium">{s.title}</span>
            <span className="text-muted-foreground shrink-0 text-xs">
              {s.year}
            </span>
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
      key: "monitored",
      header: (
        <span className="sr-only" title={tCols("monitored")}>
          {tCols("monitored")}
        </span>
      ),
      className: "w-8",
      render: (s) =>
        s.monitored ? (
          <Eye className="text-ok size-3.5" aria-label={t("monitoredYes")} />
        ) : (
          <EyeOff
            className="text-muted-foreground size-3.5"
            aria-label={t("monitoredNo")}
          />
        ),
    },
    {
      key: "profile",
      header: profileHeaderLabel,
      className: "w-32 text-muted-foreground",
      filter: (
        <ProfileColumnFunnel
          profiles={profiles}
          filters={filters}
          onChange={onFilterChange}
          columnLabel={profileHeaderLabel}
        />
      ),
      render: (s) => (
        <span className="truncate text-xs">
          {profiles?.find((p) => p.id === s.qualityProfileId)?.name ?? "—"}
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
      render: (s) => {
        if (isProfileMode(scoringMode) && s.episodeFiles.length === 0) {
          return (
            <span className="text-muted-foreground text-xs">{t("noFile")}</span>
          );
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
      render: (s) => {
        const items = ISSUES_FOR[scoringMode](s);
        if (!items.length) return null;
        const visible = items.slice(0, issuesVisible);
        const overflow = items.slice(issuesVisible);
        return (
          <div className="flex min-w-0 flex-nowrap items-center gap-1 overflow-hidden">
            {visible.map((cf) => (
              <CfBadge key={cf.id} name={cf.name} missing />
            ))}
            {overflow.length > 0 && (
              <Popover>
                <PopoverTrigger
                  className="border-input hover:bg-accent text-muted-foreground inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  +{overflow.length}
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  className="w-auto max-w-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex flex-wrap gap-1">
                    {items.map((cf) => (
                      <CfBadge key={cf.id} name={cf.name} missing />
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        );
      },
    },
  ];
}
