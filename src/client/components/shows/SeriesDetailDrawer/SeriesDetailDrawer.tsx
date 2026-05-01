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
import { Accordion } from "@/client/components/ui/accordion";
import { ScoreLabel } from "@/client/components/media/ScoreLabel";
import { SeverityDot } from "@/client/components/media/SeverityDot";
import { SeasonAccordion } from "@/client/components/shows/SeasonAccordion";
import { groupBySeason } from "@/client/components/shows/utils";
import { getSeverity } from "@/client/lib/severity";
import type { FlaggedSeries, ScoringMode } from "@/shared/types/models";

interface Props {
  series: FlaggedSeries | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scoringMode: ScoringMode;
  onSearch: (series: FlaggedSeries) => void;
  onIgnore: (series: FlaggedSeries) => void;
  onDelete?: (series: FlaggedSeries, triggerSearch: boolean) => void;
}

export function SeriesDetailDrawer({
  series,
  open,
  onOpenChange,
  scoringMode,
  onSearch,
  onIgnore,
  onDelete,
}: Props) {
  if (!series) return null;

  const score = scoringMode === "profile" ? series.customFormatScore : series.cfScore;
  const severity = getSeverity(score, series.minProfileScore, scoringMode);
  const seasonMap = groupBySeason(series.episodeFiles);
  const seasons = Array.from(seasonMap.keys()).sort((a, b) => a - b);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col gap-0">
        <SheetHeader className="border-b">
          <div className="flex items-center gap-2">
            <SeverityDot severity={severity} />
            <SheetTitle className="text-base">{series.title}</SheetTitle>
          </div>
          <p className="text-xs text-muted-foreground">{series.year}</p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <span className="text-muted-foreground">Score</span>
            <span><ScoreLabel score={score} minProfileScore={series.minProfileScore} /></span>
            <span className="text-muted-foreground">Episodes</span>
            <span className="tabular-nums">{series.affectedEpisodeCount} / {series.totalEpisodeCount}</span>
          </div>

          <div className="border-t pt-3">
            <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Seasons</h3>
            {seasons.length > 0 ? (
              <Accordion>
                {seasons.map((season) => (
                  <SeasonAccordion
                    key={season}
                    season={season}
                    files={seasonMap.get(season)!}
                    scoringMode={scoringMode}
                  />
                ))}
              </Accordion>
            ) : (
              <p className="text-muted-foreground text-sm">No episode files found.</p>
            )}
          </div>
        </div>

        <SheetFooter className="border-t flex-row gap-2 justify-end flex-wrap">
          <Button variant="outline" size="sm" onClick={() => onIgnore(series)}>
            <EyeOff className="h-4 w-4 mr-1" /> Ignore
          </Button>
          {onDelete && series.episodeFiles.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={() => onDelete(series, false)}>
                <Trash2 className="h-4 w-4 mr-1 text-destructive" /> Delete
              </Button>
              <Button variant="outline" size="sm" onClick={() => onDelete(series, true)}>
                <Trash2 className="h-4 w-4 mr-1 text-destructive" /> Delete & Search
              </Button>
            </>
          )}
          <Button size="sm" onClick={() => onSearch(series)}>
            <Search className="h-4 w-4 mr-1" /> Search
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
