import { Eye, EyeOff } from "lucide-react";
import { CfBadge } from "@/client/components/common/CfBadge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/client/components/ui/popover";
import { ScoreLabel } from "@/client/components/common/ScoreLabel";
import { CfColumnFunnel } from "@/client/components/media/CfColumnFunnel";
import { MonitorColumnFunnel } from "@/client/components/media/MonitorColumnFunnel";
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
    density,
    filters,
    onFilterChange,
    cfOptions,
    t,
    tCols,
    tTime,
    tA11y,
  } = ctx;
  const issuesVisible = density === "compact" ? 1 : 2;
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
      id: "severity",
      header: () => <span className="sr-only">{tCols("severity")}</span>,
      size: 56,
      minSize: 56,
      maxSize: 96,
      enableSorting: false,
      meta: {
        filter: (
          <SeverityColumnFunnel
            filters={filters}
            onChange={onFilterChange}
            columnLabel={tCols("severity")}
          />
        ),
      },
      cell: ({ row: { original: m } }) => {
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
      id: "title",
      accessorFn: (m) => m.title,
      header: () => tCols("title"),
      size: 240,
      minSize: 160,
      maxSize: 480,
      meta: { sortKey: "title" },
      cell: ({ row: { original: m } }) => (
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
      id: "monitored",
      header: () => (
        <span
          className="text-muted-foreground inline-flex"
          title={tCols("monitored")}
          aria-label={tCols("monitored")}
        >
          <Eye className="size-3.5" aria-hidden />
        </span>
      ),
      size: 80,
      minSize: 72,
      maxSize: 120,
      enableSorting: false,
      meta: {
        filter: (
          <MonitorColumnFunnel
            filters={filters}
            onChange={onFilterChange}
            columnLabel={tCols("monitored")}
          />
        ),
      },
      cell: ({ row: { original: m } }) =>
        m.monitored ? (
          <Eye className="text-ok size-3.5" aria-label={t("monitoredYes")} />
        ) : (
          <EyeOff
            className="text-muted-foreground size-3.5"
            aria-label={t("monitoredNo")}
          />
        ),
    },
    {
      id: "profile",
      header: () => profileHeaderLabel,
      size: 144,
      minSize: 96,
      maxSize: 240,
      enableSorting: false,
      meta: {
        className: "text-muted-foreground",
        filter: (
          <ProfileColumnFunnel
            profiles={profiles}
            filters={filters}
            onChange={onFilterChange}
            columnLabel={profileHeaderLabel}
          />
        ),
      },
      cell: ({ row: { original: m } }) => (
        <span className="truncate text-xs">
          {profiles?.find((p) => p.id === m.qualityProfileId)?.name ?? "—"}
        </span>
      ),
    },
    {
      id: "score",
      accessorFn: (m) => SCORE_FOR[scoringMode](m),
      header: () => scoreHeaderLabel,
      size: 144,
      minSize: 112,
      maxSize: 240,
      meta: {
        sortKey: "score",
        className: "whitespace-nowrap",
        filter: (
          <ScoreColumnFunnel
            scoringMode={scoringMode}
            filters={filters}
            onChange={onFilterChange}
            columnLabel={scoreHeaderLabel}
          />
        ),
      },
      cell: ({ row: { original: m } }) => {
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
      id: "size",
      accessorFn: (m) => m.sizeOnDisk,
      header: () => sizeHeaderLabel,
      size: 112,
      minSize: 88,
      maxSize: 200,
      meta: {
        sortKey: "size",
        className:
          "text-xs text-muted-foreground tabular-nums whitespace-nowrap",
        filter: (
          <SizeColumnFunnel
            filters={filters}
            onChange={onFilterChange}
            columnLabel={sizeHeaderLabel}
          />
        ),
      },
      cell: ({ row: { original: m } }) => formatBytes(m.sizeOnDisk),
    },
    {
      id: "issues",
      header: () => issuesHeaderLabel,
      size: 240,
      minSize: 160,
      enableSorting: false,
      meta: {
        grow: true,
        filter: (
          <CfColumnFunnel
            scoringMode={scoringMode}
            options={cfFunnelOptions}
            filters={filters}
            onChange={onFilterChange}
            columnLabel={issuesHeaderLabel}
          />
        ),
      },
      cell: ({ row: { original: m } }) => {
        const items = ISSUES_FOR[scoringMode](m);
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
                  aria-label={tA11y("issueOverflow", {
                    count: overflow.length,
                  })}
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
