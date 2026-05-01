import type { EpisodeFileEntry, ScoringMode } from "@/shared/types/models";
import { AccordionItem, AccordionTrigger, AccordionContent } from "@/client/components/ui/accordion";
import { Button } from "@/client/components/ui/button";
import { Search, Trash2 } from "lucide-react";
import { EpisodeFileRow } from "../EpisodeFileRow";

interface Props {
  season: number;
  files: EpisodeFileEntry[];
  scoringMode: ScoringMode;
  affectedCount: number;
  onSearch: () => Promise<unknown>;
  onDelete: (search: boolean) => Promise<unknown>;
  onSearchFile: (fileId: number, relativePath: string) => Promise<unknown>;
  onDeleteFile: (fileId: number, relativePath: string, search: boolean) => Promise<unknown>;
}

export function SeasonAccordion({
  season,
  files,
  scoringMode,
  affectedCount,
  onSearch,
  onDelete,
  onSearchFile,
  onDeleteFile,
}: Props) {
  return (
    <AccordionItem value={`season-${season}`}>
      <div className="relative">
        <AccordionTrigger className="px-3 pr-24">
          <div className="flex w-full items-center justify-between pr-2 gap-2">
            <span className="text-sm font-medium">Season {season}</span>
            <span className="text-xs text-muted-foreground">
              {affectedCount} / {files.length} episodes
            </span>
          </div>
        </AccordionTrigger>
        {affectedCount > 0 && (
          <div className="absolute right-9 top-1/2 -translate-y-1/2 z-10 flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title={`Search Season ${season}`}
              onClick={() => onSearch()}
            >
              <Search className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title={`Delete affected files in Season ${season}`}
              onClick={() => onDelete(false)}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        )}
      </div>
      <AccordionContent>
        <div className="flex flex-col gap-1.5 px-1 pt-1">
          {files.map((f) => (
            <EpisodeFileRow
              key={f.id}
              file={f}
              scoringMode={scoringMode}
              onSearch={() => onSearchFile(f.id, f.relativePath)}
              onDelete={(search) => onDeleteFile(f.id, f.relativePath, search)}
            />
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
