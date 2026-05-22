"use client";
import { useTranslations } from "next-intl";
import { EyeOff } from "lucide-react";
import { Button } from "@/client/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/client/components/ui/sheet";
import { Accordion } from "@/client/components/ui/accordion";
import { ScoreLabel } from "@/client/components/common/ScoreLabel";
import { SeverityDot } from "@/client/components/common/SeverityDot";
import { getSeverity } from "@/client/lib/severity";
import { useConfirm } from "@/client/hooks/ui/useConfirm";
import { SCORE_FOR, isProfileMode } from "@/shared/scoring-mode";
import type {
  SeriesItem,
  QualityProfile,
  ScoringMode,
} from "@/shared/types/models";
import { groupBySeason, filename } from "@/app/shows/components/utils";
import { SeasonAccordion } from "@/app/shows/components/SeasonAccordion";

interface Props {
  series: SeriesItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scoringMode: ScoringMode;
  profiles: QualityProfile[] | undefined;
  onIgnore: (series: SeriesItem) => void;
  onSearchSeason: (
    series: SeriesItem,
    seasonNumber: number,
  ) => Promise<unknown>;
  onSearchEpisode: (
    series: SeriesItem,
    fileId: number,
    label: string,
  ) => Promise<unknown>;
  onDeleteSeason: (
    series: SeriesItem,
    seasonNumber: number,
    fileIds: number[],
  ) => Promise<unknown>;
  onDeleteEpisode: (
    series: SeriesItem,
    fileId: number,
    label: string,
  ) => Promise<unknown>;
}

export function SeriesDetailDrawer({
  series,
  open,
  onOpenChange,
  scoringMode,
  profiles,
  onIgnore,
  onSearchSeason,
  onSearchEpisode,
  onDeleteSeason,
  onDeleteEpisode,
}: Props) {
  const tSeason = useTranslations("confirm.deleteSeason");
  const tEpisode = useTranslations("confirm.deleteEpisode");
  const tShows = useTranslations("shows");
  const tDrawer = useTranslations("shows.drawer");
  const tCommon = useTranslations("common");
  const { confirm: askConfirm, dialog: confirmDialog } = useConfirm();
  if (!series) return null;

  const hasFiles = series.episodeFiles.length > 0;
  const score = SCORE_FOR[scoringMode](series);
  const severity = getSeverity(
    score,
    series.minProfileScore,
    scoringMode,
    hasFiles,
  );
  const seasonMap = groupBySeason(series.episodeFiles);
  const seasons = Array.from(seasonMap.keys()).sort((a, b) => a - b);
  const profileName = profiles?.find(
    (p) => p.id === series.qualityProfileId,
  )?.name;
  // In profile mode the score is meaningless without a file (no
  // customFormatScore to compare to the cutoff). Card and table show
  // "No file"; the drawer matches.
  const showNoFile = isProfileMode(scoringMode) && !hasFiles;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-2xl">
        <SheetHeader className="border-b">
          <div className="flex items-center gap-2">
            <SeverityDot severity={severity} />
            <SheetTitle className="text-base">{series.title}</SheetTitle>
          </div>
          <p className="text-muted-foreground text-xs">{series.year}</p>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <span className="text-muted-foreground">{tDrawer("score")}</span>
            <span>
              {showNoFile ? (
                <span className="text-muted-foreground text-xs">
                  {tShows("noFile")}
                </span>
              ) : (
                <ScoreLabel
                  score={score}
                  minProfileScore={series.minProfileScore}
                />
              )}
            </span>
            <span className="text-muted-foreground">{tDrawer("profile")}</span>
            <span>{profileName ?? "—"}</span>
            <span className="text-muted-foreground">{tDrawer("episodes")}</span>
            <span className="tabular-nums">
              {series.affectedEpisodeCount} / {series.totalEpisodeCount}
            </span>
          </div>

          <div className="border-t pt-3">
            <h3 className="text-muted-foreground mb-2 text-xs tracking-wide uppercase">
              {tDrawer("seasons")}
            </h3>
            {seasons.length > 0 ? (
              <Accordion>
                {seasons.map((season) => {
                  const files = seasonMap.get(season)!;
                  const affectedFileIds = files
                    .filter((f) =>
                      isProfileMode(scoringMode)
                        ? f.minProfileScore !== undefined &&
                          f.customFormatScore < f.minProfileScore
                        : f.missingFormats.length > 0,
                    )
                    .map((f) => f.id);
                  return (
                    <SeasonAccordion
                      key={season}
                      season={season}
                      files={files}
                      scoringMode={scoringMode}
                      onSearch={() => onSearchSeason(series, season)}
                      onDelete={async () => {
                        if (affectedFileIds.length === 0) return;
                        const ok = await askConfirm({
                          title: tSeason("title"),
                          body: tSeason("body", {
                            count: affectedFileIds.length,
                            season,
                          }),
                          destructive: true,
                        });
                        if (!ok) return;
                        await onDeleteSeason(series, season, affectedFileIds);
                      }}
                      onSearchFile={(fileId, relativePath) =>
                        onSearchEpisode(series, fileId, filename(relativePath))
                      }
                      onDeleteFile={async (fileId, relativePath) => {
                        const label = filename(relativePath);
                        const ok = await askConfirm({
                          title: tEpisode("title"),
                          body: tEpisode("body", { label }),
                          destructive: true,
                        });
                        if (!ok) return;
                        await onDeleteEpisode(series, fileId, label);
                      }}
                      affectedCount={affectedFileIds.length}
                    />
                  );
                })}
              </Accordion>
            ) : (
              <p className="text-muted-foreground text-sm">
                {tShows("noEpisodeFiles")}
              </p>
            )}
          </div>
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t">
          <Button variant="outline" size="sm" onClick={() => onIgnore(series)}>
            <EyeOff className="mr-1 size-4" /> {tCommon("ignore")}
          </Button>
        </SheetFooter>
        {confirmDialog}
      </SheetContent>
    </Sheet>
  );
}
