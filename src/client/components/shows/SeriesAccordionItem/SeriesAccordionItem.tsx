import type { FlaggedSeries, ScoringMode } from "@/shared/types/models";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/client/components/ui/accordion";
import { Checkbox } from "@/client/components/ui/checkbox";
import { ScoreLabel } from "@/client/components/media/ScoreLabel";
import { SeasonAccordion } from "../SeasonAccordion";
import { groupBySeason } from "../utils";

interface Props {
  series: FlaggedSeries;
  selected: boolean;
  onToggle: () => void;
  scoringMode: ScoringMode;
}

export function SeriesAccordionItem({ series, selected, onToggle, scoringMode }: Props) {
  const seasonMap = groupBySeason(series.episodeFiles);
  const seasons = Array.from(seasonMap.keys()).sort((a, b) => a - b);
  const score = scoringMode === "profile" ? series.customFormatScore : series.cfScore;

  return (
    <AccordionItem value={`series-${series.id}`}>
      <AccordionTrigger className="px-3">
        <div className="flex w-full items-center justify-between gap-4 pr-2">
          <div className="flex items-center gap-3 min-w-0">
            <span
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
              className="shrink-0"
            >
              <Checkbox checked={selected} onCheckedChange={onToggle} />
            </span>
            <span className="font-medium truncate">{series.title}</span>
            <span className="text-muted-foreground text-sm shrink-0">{series.year}</span>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <ScoreLabel score={score} minProfileScore={series.minProfileScore} />
            <span className="text-xs text-muted-foreground">
              {series.affectedEpisodeCount} / {series.totalEpisodeCount} episodes
            </span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        {seasons.length > 0 ? (
          <Accordion className="pl-4">
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
          <p className="text-sm text-muted-foreground px-3 py-1">No episode files found.</p>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
