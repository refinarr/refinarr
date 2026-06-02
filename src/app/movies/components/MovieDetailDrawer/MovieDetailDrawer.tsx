"use client";
import { useTranslations } from "next-intl";
import { Search, EyeOff, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/client/components/ui/sheet";
import { Button } from "@/client/components/ui/button";
import { ScoreLabel } from "@/client/components/common/ScoreLabel";
import { CfBreakdown } from "@/client/components/common/CfBreakdown";
import { SeverityDot } from "@/client/components/common/SeverityDot";
import { getSeverity } from "@/client/lib/severity";
import { scoreForItem } from "@/shared/scoring-mode";
import type { MovieItem, QualityProfile } from "@/shared/types/models";

interface Props {
  movie: MovieItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profiles: QualityProfile[] | undefined;
  onSearch: (movie: MovieItem) => void;
  onIgnore: (movie: MovieItem) => void;
  onDelete?: (movie: MovieItem) => void;
}

export function MovieDetailDrawer({
  movie,
  open,
  onOpenChange,
  profiles,
  onSearch,
  onIgnore,
  onDelete,
}: Props) {
  const tDrawer = useTranslations("movies.drawer");
  const tCommon = useTranslations("common");
  if (!movie) return null;

  const score = scoreForItem(movie);
  const severity = getSeverity(score, movie.minProfileScore, movie.hasFile);
  const hasCfs =
    movie.customFormats.length > 0 || movie.missingFormats.length > 0;
  const profileName = profiles?.find(
    (p) => p.id === movie.qualityProfileId,
  )?.name;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-xl">
        <SheetHeader className="border-b">
          <div className="flex items-center gap-2">
            <SeverityDot severity={severity} />
            <SheetTitle className="text-base">{movie.title}</SheetTitle>
          </div>
          <p className="text-muted-foreground text-xs">{movie.year}</p>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <span className="text-muted-foreground">{tDrawer("score")}</span>
            <span>
              <ScoreLabel
                score={score}
                minProfileScore={movie.minProfileScore}
              />
            </span>
            <span className="text-muted-foreground">{tDrawer("profile")}</span>
            <span>{profileName ?? "—"}</span>
            <span className="text-muted-foreground">{tDrawer("hasFile")}</span>
            <span>{movie.hasFile ? tCommon("yes") : tCommon("no")}</span>
          </div>

          <div className="border-t pt-3">
            <h3 className="text-muted-foreground mb-2 text-xs tracking-wide uppercase">
              {tDrawer("customFormats")}
            </h3>
            {(() => {
              if (!movie.hasFile)
                return (
                  <p className="text-muted-foreground text-sm">
                    {tDrawer("noFileDownloaded")}
                  </p>
                );
              if (hasCfs)
                return (
                  <CfBreakdown
                    customFormats={movie.customFormats}
                    missingFormats={movie.missingFormats}
                  />
                );
              return (
                <p className="text-muted-foreground text-sm">
                  {tDrawer("noCfData")}
                </p>
              );
            })()}
          </div>
        </div>

        <SheetFooter className="flex-row flex-wrap justify-end gap-2 border-t">
          <Button variant="outline" size="sm" onClick={() => onIgnore(movie)}>
            <EyeOff className="mr-1 size-4" /> {tCommon("ignore")}
          </Button>
          {onDelete && movie.hasFile && movie.movieFileId > 0 && (
            <Button variant="outline" size="sm" onClick={() => onDelete(movie)}>
              <Trash2 className="text-destructive mr-1 size-4" />{" "}
              {tCommon("delete")}
            </Button>
          )}
          <Button size="sm" onClick={() => onSearch(movie)}>
            <Search className="mr-1 size-4" /> {tCommon("search")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
