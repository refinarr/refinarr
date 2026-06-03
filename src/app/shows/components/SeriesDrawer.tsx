"use client";
import { useState } from "react";
import { useShowSeasonEpisodeActions } from "@/client/hooks/media/useShowSeasonEpisodeActions";
import type { MediaListShellRenderCtx } from "@/client/components/media/MediaListShell";
import { ReleasePickerDialog } from "@/client/components/media/ReleasePickerDialog";
import type { SeriesItem } from "@/shared/types/models";
import { SeriesDetailDrawer } from "./SeriesDetailDrawer";

interface Props {
  item: SeriesItem | null;
  ctx: MediaListShellRenderCtx<SeriesItem>;
  close: () => void;
}

// Wrapper around SeriesDetailDrawer. This is a component (not just JSX) so
// it can call useShowSeasonEpisodeActions — the season/episode mutations
// that are sonarr-specific and don't belong in the generic MediaListShell —
// and own the per-season interactive-search release picker. The shell's
// renderDrawer slot mounts this; from here we call hooks as normal.
export function SeriesDrawer({ item, ctx, close }: Props) {
  const seasonEpisode = useShowSeasonEpisodeActions({
    instanceId: ctx.activeInstance,
    refetch: ctx.refetch,
  });
  // Store just the season identity; derive the title from the current
  // series at render so a stale preformatted string can't leak across a
  // drawer close/reopen for a different series.
  const [pickerSeason, setPickerSeason] = useState<number | null>(null);

  return (
    <>
      <SeriesDetailDrawer
        series={item}
        open={item !== null}
        onOpenChange={(open) => {
          if (open) return;
          setPickerSeason(null);
          close();
        }}
        profiles={ctx.profiles}
        onIgnore={async () => {
          if (!item) return;
          await ctx.runIgnore(item);
          close();
        }}
        onSearchSeason={seasonEpisode.runSearchSeason}
        onSearchEpisode={seasonEpisode.runSearchEpisode}
        onDeleteSeason={seasonEpisode.runDeleteSeason}
        onDeleteEpisode={seasonEpisode.runDeleteEpisode}
        onInteractiveSearchSeason={(_series, seasonNumber) =>
          setPickerSeason(seasonNumber)
        }
      />
      {item && pickerSeason !== null && (
        <ReleasePickerDialog
          open
          onOpenChange={(open) => !open && setPickerSeason(null)}
          arrType={ctx.arrType}
          instanceId={ctx.activeInstance}
          title={`${item.title} — Season ${pickerSeason}`}
          target={{
            kind: "season",
            seriesId: item.id,
            seasonNumber: pickerSeason,
          }}
        />
      )}
    </>
  );
}
