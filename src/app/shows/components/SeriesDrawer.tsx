"use client";
import { useShowSeasonEpisodeActions } from "@/client/hooks/media/useShowSeasonEpisodeActions";
import type { MediaListShellRenderCtx } from "@/client/components/media/MediaListShell";
import type { SeriesItem } from "@/shared/types/models";
import { SeriesDetailDrawer } from "./SeriesDetailDrawer";

interface Props {
  item: SeriesItem | null;
  ctx: MediaListShellRenderCtx<SeriesItem>;
  close: () => void;
}

// Wrapper around SeriesDetailDrawer. This is a component (not just JSX) so
// it can call useShowSeasonEpisodeActions — the season/episode mutations
// that are sonarr-specific and don't belong in the generic MediaListShell.
// The shell's renderDrawer slot mounts this; from here we call hooks as
// normal.
export function SeriesDrawer({ item, ctx, close }: Props) {
  const seasonEpisode = useShowSeasonEpisodeActions({
    instanceId: ctx.activeInstance,
    refetch: ctx.refetch,
  });

  return (
    <SeriesDetailDrawer
      series={item}
      open={item !== null}
      onOpenChange={(open) => !open && close()}
      scoringMode={ctx.scoringMode}
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
    />
  );
}
