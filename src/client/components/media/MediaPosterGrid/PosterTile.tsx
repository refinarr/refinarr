"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Bookmark, ImageOff } from "lucide-react";
import { cn } from "@/client/lib/utils";
import { posterUrl } from "@/client/lib/poster";
import { formatBytes } from "@/client/lib/format";
import { SeverityDot } from "@/client/components/common/SeverityDot";
import {
  getSeverity,
  severityClass,
  severityTextClass,
} from "@/client/lib/severity";
import type { MediaListShellRenderCtx } from "@/client/components/media/MediaListShell";
import { scoreForItem } from "@/shared/scoring-mode";
import type { MediaItem } from "@/shared/types/models";

interface Props<T extends MediaItem> {
  item: T;
  ctx: MediaListShellRenderCtx<T>;
}

type ImgState = "loading" | "loaded" | "failed";

// Fraction (0–100) of the way to the cutoff. Below-zero scores (penalties
// dragging the file under 0) clamp to an empty bar; at/above cutoff fills.
function scorePct(score: number, cutoff: number): number {
  if (cutoff <= 0) return score >= cutoff ? 100 : 0;
  return Math.max(0, Math.min(100, (score / cutoff) * 100));
}

// Poster-grid tile: a self-contained card — poster + a metadata body
// (quality profile · size, monitored state, a score-vs-cutoff progress
// bar, and the penalty / missing-format detail that is the whole point of
// the app). The grid wrapper owns selection / click / focus; this is pure
// presentation. Generic over MediaItem so it serves movies and series:
// file presence comes from `existingFileCount` (movies 0/1, series the
// episode-file count).
export function PosterTile<T extends MediaItem>({ item, ctx }: Props<T>) {
  const { arrType, activeInstance, profiles } = ctx;
  const tCommon = useTranslations("common");
  const [imgState, setImgState] = useState<ImgState>("loading");

  const score = scoreForItem(item);
  const hasFile = item.existingFileCount > 0;
  const cutoff = item.minProfileScore;
  const severity = getSeverity(score, cutoff, hasFile);
  const profileName = profiles?.find(
    (p) => p.id === item.qualityProfileId,
  )?.name;
  const penalties = item.unwantedFormats ?? [];
  const missing = item.missingFormats ?? [];

  let scoreText: string;
  if (!hasFile) scoreText = ctx.t("noFile");
  else if (cutoff !== undefined) scoreText = `${score} / ${cutoff}`;
  else scoreText = String(score);

  return (
    <div
      data-testid="poster-tile"
      className="bg-card flex h-full flex-col overflow-hidden rounded-md border"
    >
      <div className="bg-muted relative aspect-2/3 overflow-hidden">
        {imgState === "failed" ? (
          <div className="text-muted-foreground flex size-full flex-col items-center justify-center gap-1 p-2 text-center">
            <ImageOff className="size-5" aria-hidden />
            <span className="line-clamp-3 text-xs">{item.title}</span>
          </div>
        ) : (
          <>
            {/* Shimmer placeholder until the poster paints — reserves the
                2:3 box (no layout shift) while the proxied image streams in. */}
            {imgState === "loading" && (
              <div className="bg-muted absolute inset-0 animate-pulse" />
            )}
            {/* Plain <img> (no next/image — sharp is excluded from the
                standalone build). loading=lazy so off-screen posters never
                hit the proxy until scrolled near. Fade in on load. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={posterUrl(arrType, activeInstance, item.id)}
              alt={item.title}
              loading="lazy"
              className={cn(
                "size-full object-cover transition-opacity duration-200",
                imgState === "loaded" ? "opacity-100" : "opacity-0",
              )}
              onLoad={() => setImgState("loaded")}
              onError={() => setImgState("failed")}
            />
          </>
        )}
        {/* Severity dot, top-right (the grid wrapper's selection checkbox
            owns top-left). The numeric score sits with the bar below. */}
        <span className="bg-background/85 absolute top-1 right-1 flex items-center rounded-sm p-1 backdrop-blur-sm">
          <SeverityDot severity={severity} />
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1 p-2">
        <div className="flex items-start gap-1">
          <p
            className="min-w-0 flex-1 truncate text-xs/tight font-medium"
            title={item.title}
          >
            {item.title}
          </p>
          <Bookmark
            className={cn(
              "mt-0.5 size-3 shrink-0",
              item.monitored
                ? "text-foreground/70 fill-current"
                : "text-muted-foreground/40",
            )}
            aria-label={tCommon(item.monitored ? "monitored" : "unmonitored")}
          />
        </div>

        <p
          className="text-muted-foreground truncate text-[10px] leading-tight"
          title={profileName}
        >
          {profileName ? `${item.year} · ${profileName}` : String(item.year)}
        </p>

        {/* Score-vs-cutoff: the value plus a Profilarr-style progress bar.
            The bar fills toward the cutoff; the numeric value stays visible
            even when a penalty drags the score to an empty bar. */}
        <div className="mt-0.5 space-y-0.5">
          <div className="flex items-center justify-between gap-1 text-[10px]/4 tabular-nums">
            <span className="text-muted-foreground truncate">
              {formatBytes(item.sizeOnDisk)}
            </span>
            <span
              className={cn(
                "shrink-0 font-semibold",
                severityTextClass[severity],
              )}
            >
              {scoreText}
            </span>
          </div>
          {hasFile && cutoff !== undefined && (
            <div
              role="progressbar"
              aria-valuenow={score}
              aria-valuemax={cutoff}
              className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
            >
              <div
                className={cn("h-full rounded-full", severityClass[severity])}
                style={{ width: `${scorePct(score, cutoff)}%` }}
              />
            </div>
          )}
        </div>

        {/* Penalties (negative CFs present) + a missing-format count — the
            named detail lives in the drawer; the card surfaces the signal. */}
        {(penalties.length > 0 || missing.length > 0) && (
          <div className="mt-auto flex flex-wrap items-center gap-1 pt-0.5">
            {penalties.slice(0, 2).map((cf) => (
              <span
                key={cf.id}
                title={cf.name}
                className="bg-critical/15 text-critical max-w-full truncate rounded-sm px-1 text-[10px]/4 font-medium"
              >
                {cf.name}
              </span>
            ))}
            {penalties.length > 2 && (
              <span className="text-critical text-[10px]/4">
                +{penalties.length - 2}
              </span>
            )}
            {missing.length > 0 && (
              <span className="bg-muted text-muted-foreground rounded-sm px-1 text-[10px]/4">
                {tCommon("missingCount", { count: missing.length })}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
