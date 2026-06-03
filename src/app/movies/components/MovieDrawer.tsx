"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useConfirm } from "@/client/hooks/ui/useConfirm";
import type { MediaListShellRenderCtx } from "@/client/components/media/MediaListShell";
import { ReleasePickerDialog } from "@/client/components/media/ReleasePickerDialog";
import type { MovieItem } from "@/shared/types/models";
import { MovieDetailDrawer } from "./MovieDetailDrawer";

interface Props {
  item: MovieItem | null;
  ctx: MediaListShellRenderCtx<MovieItem>;
  close: () => void;
}

// Wrapper around MovieDetailDrawer that owns the per-row delete-confirm
// dialog + the interactive-search release picker. Lives in
// app/movies/components/ because the confirm wording is movie-specific.
// The MediaListShell renders this via its renderDrawer prop so the hook
// composition stays clean.
export function MovieDrawer({ item, ctx, close }: Props) {
  const tConfirmDeleteFile = useTranslations("confirm.deleteFile");
  const { confirm: askConfirm, dialog: confirmDialog } = useConfirm();
  // Key the picker to the movie that opened it (not a bare boolean) so it
  // can't survive a close() and reopen when a different movie is selected.
  const [pickerMovieId, setPickerMovieId] = useState<number | null>(null);

  return (
    <>
      <MovieDetailDrawer
        movie={item}
        open={item !== null}
        onOpenChange={(open) => {
          if (open) return;
          setPickerMovieId(null);
          close();
        }}
        profiles={ctx.profiles}
        onInteractiveSearch={(movie) => setPickerMovieId(movie.id)}
        onSearch={async () => {
          if (!item) return;
          await ctx.runSearch(item);
          close();
        }}
        onIgnore={async () => {
          if (!item) return;
          await ctx.runIgnore(item);
          close();
        }}
        onDelete={async () => {
          if (!item) return;
          const ok = await askConfirm({
            title: tConfirmDeleteFile("title"),
            body: tConfirmDeleteFile("body", { title: item.title }),
            destructive: true,
          });
          if (!ok) return;
          await ctx.runDelete(item);
          close();
        }}
      />
      {item && pickerMovieId === item.id && (
        <ReleasePickerDialog
          open
          onOpenChange={(open) => !open && setPickerMovieId(null)}
          arrType={ctx.arrType}
          instanceId={ctx.activeInstance}
          title={item.title}
          target={{ kind: "movie", movieId: item.id }}
        />
      )}
      {confirmDialog}
    </>
  );
}
