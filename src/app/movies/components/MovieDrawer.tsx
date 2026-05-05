"use client";
import { useTranslations } from "next-intl";
import { MovieDetailDrawer } from "./MovieDetailDrawer";
import { useConfirm } from "@/client/hooks/ui/useConfirm";
import type { MediaListShellRenderCtx } from "@/client/components/media/MediaListShell";
import type { FlaggedMovie } from "@/shared/types/models";

interface Props {
  item: FlaggedMovie | null;
  ctx: MediaListShellRenderCtx<FlaggedMovie>;
  close: () => void;
}

// Wrapper around MovieDetailDrawer that owns the per-row delete-confirm
// dialog. Lives in app/movies/components/ because the confirm wording is
// movie-specific. The MediaListShell renders this via its renderDrawer
// prop so the hook composition stays clean.
export function MovieDrawer({ item, ctx, close }: Props) {
  const tConfirmDeleteFile = useTranslations("confirm.deleteFile");
  const { confirm: askConfirm, dialog: confirmDialog } = useConfirm();

  return (
    <>
      <MovieDetailDrawer
        movie={item}
        open={item !== null}
        onOpenChange={(open) => !open && close()}
        scoringMode={ctx.scoringMode}
        profiles={ctx.profiles}
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
        onDelete={async (_m, triggerSearch) => {
          if (!item) return;
          const ok = await askConfirm({
            title: tConfirmDeleteFile("title"),
            body: tConfirmDeleteFile("body", { title: item.title }),
            destructive: true,
          });
          if (!ok) return;
          await ctx.runDelete(item, triggerSearch);
          close();
        }}
      />
      {confirmDialog}
    </>
  );
}
