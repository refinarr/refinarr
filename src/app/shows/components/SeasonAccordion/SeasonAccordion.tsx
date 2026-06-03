"use client";
import { useTranslations } from "next-intl";
import { Search, Trash2, ListVideo } from "lucide-react";
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/client/components/ui/accordion";
import { Button } from "@/client/components/ui/button";
import type { EpisodeFileEntry } from "@/shared/types/models";
import { EpisodeFileRow } from "../EpisodeFileRow";

interface Props {
  season: number;
  files: EpisodeFileEntry[];
  affectedCount: number;
  onSearch: () => Promise<unknown>;
  onDelete: () => Promise<unknown>;
  onSearchFile: (fileId: number, relativePath: string) => Promise<unknown>;
  onDeleteFile: (fileId: number, relativePath: string) => Promise<unknown>;
  // Opens the interactive-search release picker for this season. Available
  // regardless of affectedCount — interactive grab is a manual override.
  onInteractive?: () => void;
}

export function SeasonAccordion({
  season,
  files,
  affectedCount,
  onSearch,
  onDelete,
  onSearchFile,
  onDeleteFile,
  onInteractive,
}: Props) {
  const t = useTranslations("shows");
  return (
    <AccordionItem value={`season-${season}`}>
      <div className="relative">
        <AccordionTrigger className="px-3 pr-32">
          <div className="flex w-full items-center justify-between gap-2 pr-2">
            <span className="text-sm font-medium">
              {t("season", { season })}
            </span>
            <span className="text-muted-foreground text-xs">
              {t("seasonProgress", {
                affected: affectedCount,
                total: files.length,
              })}
            </span>
          </div>
        </AccordionTrigger>
        {(affectedCount > 0 || onInteractive) && (
          <div className="absolute top-1/2 right-2 z-10 flex -translate-y-1/2 items-center gap-1.5">
            {onInteractive && (
              <Button
                variant="ghost"
                size="icon-sm"
                title={t("interactiveSeasonAria", { season })}
                aria-label={t("interactiveSeasonAria", { season })}
                onClick={onInteractive}
              >
                <ListVideo className="size-3.5" />
              </Button>
            )}
            {affectedCount > 0 && (
              <>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title={t("searchSeasonAria", { season })}
                  aria-label={t("searchSeasonAria", { season })}
                  onClick={() => onSearch()}
                >
                  <Search className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title={t("deleteSeasonAria", { season })}
                  aria-label={t("deleteSeasonAria", { season })}
                  onClick={() => onDelete()}
                >
                  <Trash2 className="text-destructive size-3.5" />
                </Button>
              </>
            )}
          </div>
        )}
      </div>
      <AccordionContent>
        <div className="flex flex-col gap-1.5 px-1 pt-1">
          {files.map((f) => (
            <EpisodeFileRow
              key={f.id}
              file={f}
              onSearch={() => onSearchFile(f.id, f.relativePath)}
              onDelete={() => onDeleteFile(f.id, f.relativePath)}
            />
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
