"use client";
import { useTranslations } from "next-intl";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/client/components/ui/sheet";
import { Button } from "@/client/components/ui/button";
import { EyeOff } from "lucide-react";
import { Accordion } from "@/client/components/ui/accordion";
import { ScoreLabel } from "@/client/components/common/ScoreLabel";
import { SeverityDot } from "@/client/components/common/SeverityDot";
import { SeasonAccordion } from "@/client/components/shows/SeasonAccordion";
import { groupBySeason, filename } from "@/client/components/shows/utils";
import { getSeverity } from "@/client/lib/severity";
import { useConfirm } from "@/client/hooks/ui/useConfirm";
import type { FlaggedSeries, ScoringMode } from "@/shared/types/models";

interface Props {
  series: FlaggedSeries | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scoringMode: ScoringMode;
  onIgnore: (series: FlaggedSeries) => void;
  onSearchSeason: (series: FlaggedSeries, seasonNumber: number) => Promise<unknown>;
  onSearchEpisode: (series: FlaggedSeries, fileId: number, label: string) => Promise<unknown>;
  onDeleteSeason: (series: FlaggedSeries, seasonNumber: number, fileIds: number[], search: boolean) => Promise<unknown>;
  onDeleteEpisode: (series: FlaggedSeries, fileId: number, label: string, search: boolean) => Promise<unknown>;
}

export function SeriesDetailDrawer({
  series,
  open,
  onOpenChange,
  scoringMode,
  onIgnore,
  onSearchSeason,
  onSearchEpisode,
  onDeleteSeason,
  onDeleteEpisode,
}: Props) {
  const tSeason = useTranslations("confirm.deleteSeason");
  const tEpisode = useTranslations("confirm.deleteEpisode");
  const tShows = useTranslations("shows");
  const { confirm: askConfirm, dialog: confirmDialog } = useConfirm();
  if (!series) return null;

  const score = scoringMode === "profile" ? series.customFormatScore : series.cfScore;
  const severity = getSeverity(score, series.minProfileScore, scoringMode, series.episodeFiles.length > 0);
  const seasonMap = groupBySeason(series.episodeFiles);
  const seasons = Array.from(seasonMap.keys()).sort((a, b) => a - b);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col gap-0">
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
                {seasons.map((season) => {
                  const files = seasonMap.get(season)!;
                  const affectedFileIds = files
                    .filter((f) =>
                      scoringMode === "profile"
                        ? f.minProfileScore !== undefined && f.customFormatScore < f.minProfileScore
                        : f.missingFormats.length > 0
                    )
                    .map((f) => f.id);
                  return (
                    <SeasonAccordion
                      key={season}
                      season={season}
                      files={files}
                      scoringMode={scoringMode}
                      onSearch={() => onSearchSeason(series, season)}
                      onDelete={async (search) => {
                        if (affectedFileIds.length === 0) return;
                        const ok = await askConfirm({
                          title: tSeason("title"),
                          body: tSeason("body", { count: affectedFileIds.length, season }),
                          destructive: true,
                        });
                        if (!ok) return;
                        await onDeleteSeason(series, season, affectedFileIds, search);
                      }}
                      onSearchFile={(fileId, relativePath) =>
                        onSearchEpisode(series, fileId, filename(relativePath))
                      }
                      onDeleteFile={async (fileId, relativePath, search) => {
                        const label = filename(relativePath);
                        const ok = await askConfirm({
                          title: tEpisode("title"),
                          body: tEpisode("body", { label }),
                          destructive: true,
                        });
                        if (!ok) return;
                        await onDeleteEpisode(series, fileId, label, search);
                      }}
                      affectedCount={affectedFileIds.length}
                    />
                  );
                })}
              </Accordion>
            ) : (
              <p className="text-muted-foreground text-sm">{tShows("noEpisodeFiles")}</p>
            )}
          </div>
        </div>

        <SheetFooter className="border-t flex-row gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={() => onIgnore(series)}>
            <EyeOff className="h-4 w-4 mr-1" /> Ignore
          </Button>
        </SheetFooter>
        {confirmDialog}
      </SheetContent>
    </Sheet>
  );
}
