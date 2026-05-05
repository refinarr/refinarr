"use client";
import { Suspense } from "react";
import { AppShell } from "@/client/components/layout/AppShell";
import { MediaListShell } from "@/client/components/media/MediaListShell";
import { MediaTableSkeleton } from "@/client/components/media/MediaTableSkeleton";
import { MOVIE_BULK_CONFIG } from "@/client/components/media/media-bulk-configs";
import { useMovies } from "@/client/hooks/media/useMovies";
import { movieColumns } from "./components/movieColumns";
import { MovieCard } from "./components/MovieCard";
import { MovieDrawer } from "./components/MovieDrawer";

export default function MoviesPage() {
  return (
    <Suspense fallback={<AppShell><MediaTableSkeleton rows={8} /></AppShell>}>
      <MediaListShell
        arrType="radarr"
        bulkConfig={MOVIE_BULK_CONFIG}
        useQuery={useMovies}
        i18nNamespace="movies"
        confirmDeleteBulkKey="confirm.deleteMovies"
      >
        <MediaListShell.Header />
        <MediaListShell.SearchBar />
        <MediaListShell.Chips />
        <MediaListShell.BulkBar />
        <MediaListShell.Body columns={movieColumns} Card={MovieCard} />
        <MediaListShell.Drawer as={MovieDrawer} />
      </MediaListShell>
    </Suspense>
  );
}
