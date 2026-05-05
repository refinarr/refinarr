"use client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/client/components/ui/sheet";
import { Button } from "@/client/components/ui/button";
import { Search, EyeOff, Trash2 } from "lucide-react";
import { ScoreLabel } from "@/client/components/common/ScoreLabel";
import { CfScoreList } from "@/client/components/common/CfScoreList";
import { SeverityDot } from "@/client/components/common/SeverityDot";
import { getSeverity } from "@/client/lib/severity";
import type { FlaggedMovie, QualityProfile, ScoringMode } from "@/shared/types/models";

interface Props {
  movie: FlaggedMovie | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scoringMode: ScoringMode;
  profiles: QualityProfile[] | undefined;
  onSearch: (movie: FlaggedMovie) => void;
  onIgnore: (movie: FlaggedMovie) => void;
  onDelete?: (movie: FlaggedMovie, triggerSearch: boolean) => void;
}

export function MovieDetailDrawer({
  movie,
  open,
  onOpenChange,
  scoringMode,
  profiles,
  onSearch,
  onIgnore,
  onDelete,
}: Props) {
  if (!movie) return null;

  const score = scoringMode === "profile" ? movie.customFormatScore : movie.cfScore;
  const severity = getSeverity(score, movie.minProfileScore, scoringMode, movie.hasFile);
  const hasCfs = movie.customFormats.length > 0 || movie.missingFormats.length > 0;
  const profileName = profiles?.find((p) => p.id === movie.qualityProfileId)?.name;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl flex flex-col gap-0">
        <SheetHeader className="border-b">
          <div className="flex items-center gap-2">
            <SeverityDot severity={severity} />
            <SheetTitle className="text-base">{movie.title}</SheetTitle>
          </div>
          <p className="text-xs text-muted-foreground">{movie.year}</p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <span className="text-muted-foreground">Score</span>
            <span><ScoreLabel score={score} minProfileScore={movie.minProfileScore} /></span>
            <span className="text-muted-foreground">Profile</span>
            <span>{profileName ?? "—"}</span>
            <span className="text-muted-foreground">Has file</span>
            <span>{movie.hasFile ? "Yes" : "No"}</span>
          </div>

          <div className="border-t pt-3">
            <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Custom Formats</h3>
            {(() => {
              if (!movie.hasFile) return <p className="text-muted-foreground text-sm">No file downloaded.</p>;
              if (hasCfs) return <CfScoreList formats={movie.customFormats} missingFormats={movie.missingFormats} />;
              return <p className="text-muted-foreground text-sm">No custom format data.</p>;
            })()}
          </div>
        </div>

        <SheetFooter className="border-t flex-row flex-wrap gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={() => onIgnore(movie)}>
            <EyeOff className="h-4 w-4 mr-1" /> Ignore
          </Button>
          {onDelete && movie.hasFile && movie.movieFileId > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={() => onDelete(movie, false)}>
                <Trash2 className="h-4 w-4 mr-1 text-destructive" /> Delete
              </Button>
              <Button variant="outline" size="sm" onClick={() => onDelete(movie, true)}>
                <Trash2 className="h-4 w-4 mr-1 text-destructive" /> Delete + Search
              </Button>
            </>
          )}
          <Button size="sm" onClick={() => onSearch(movie)}>
            <Search className="h-4 w-4 mr-1" /> Search
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
