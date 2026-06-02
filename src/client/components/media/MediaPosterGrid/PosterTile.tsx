"use client";
import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/client/lib/utils";
import { posterUrl } from "@/client/lib/poster";
import { SeverityDot } from "@/client/components/common/SeverityDot";
import { getSeverity, severityTextClass } from "@/client/lib/severity";
import type { MediaListShellRenderCtx } from "@/client/components/media/MediaListShell";
import { SCORE_FOR, isProfileMode } from "@/shared/scoring-mode";
import type { MediaItem } from "@/shared/types/models";

interface Props<T extends MediaItem> {
  item: T;
  ctx: MediaListShellRenderCtx<T>;
}

// Poster-grid tile content (image + score overlay + title). The grid
// wrapper owns selection / click / focus; this is pure presentation,
// mirroring the MovieCard ⟷ MediaCard split. Generic over MediaItem:
// file presence comes from `existingFileCount` (movies: 0/1, series:
// episode-file count) so it works for both arrs without a subclass.
type ImgState = "loading" | "loaded" | "failed";

export function PosterTile<T extends MediaItem>({ item, ctx }: Props<T>) {
  const { arrType, activeInstance, scoringMode } = ctx;
  const [imgState, setImgState] = useState<ImgState>("loading");

  const score = SCORE_FOR[scoringMode](item);
  const profile = isProfileMode(scoringMode);
  const hasFile = item.existingFileCount > 0;
  const severity = getSeverity(
    score,
    item.minProfileScore,
    scoringMode,
    hasFile,
  );

  const noFileScore = profile && !hasFile;
  let scoreText: string;
  if (noFileScore) scoreText = ctx.t("noFile");
  else if (item.minProfileScore !== undefined)
    scoreText = `${score} / ${item.minProfileScore}`;
  else scoreText = `${Math.round(score * 100)}%`;

  return (
    <div className="space-y-1.5">
      <div className="bg-muted relative aspect-2/3 overflow-hidden rounded-md border">
        {imgState === "failed" ? (
          <div className="text-muted-foreground flex size-full flex-col items-center justify-center gap-1 p-2 text-center">
            <ImageOff className="size-5" aria-hidden />
            <span className="line-clamp-3 text-xs">{item.title}</span>
          </div>
        ) : (
          <>
            {/* Shimmer placeholder until the poster paints — reserves the
                2:3 box (no layout shift) and covers the blank gap while
                the proxied image streams in. */}
            {imgState === "loading" && (
              <div className="bg-muted absolute inset-0 animate-pulse" />
            )}
            {/* Plain <img> (no next/image — sharp is excluded from the
                standalone build; posters are already correctly sized by
                the *arr). loading=lazy so off-screen posters never hit
                the proxy until scrolled near. Fade in on load. */}
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
        <span
          className={cn(
            "bg-background/85 absolute top-1 right-1 flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-semibold tabular-nums backdrop-blur-sm",
            severityTextClass[severity],
          )}
        >
          <SeverityDot severity={severity} />
          {scoreText}
        </span>
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium" title={item.title}>
          {item.title}
        </p>
        <p className="text-muted-foreground text-xs tabular-nums">
          {item.year}
        </p>
      </div>
    </div>
  );
}
