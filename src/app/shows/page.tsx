"use client";
import { Suspense } from "react";
import { AppShell } from "@/client/components/layout/AppShell";
import { MediaListShell } from "@/client/components/media/MediaListShell";
import { MediaTableSkeleton } from "@/client/components/media/MediaTableSkeleton";
import { SERIES_BULK_CONFIG } from "@/client/components/media/media-bulk-configs";
import { useSeries } from "@/client/hooks/media/useSeries";
import { seriesColumns } from "./components/seriesColumns";
import { SeriesCard } from "./components/SeriesCard";
import { SeriesDrawer } from "./components/SeriesDrawer";

export default function ShowsPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <MediaTableSkeleton rows={8} />
        </AppShell>
      }
    >
      <MediaListShell
        arrType="sonarr"
        bulkConfig={SERIES_BULK_CONFIG}
        useQuery={useSeries}
        i18nNamespace="shows"
        confirmDeleteBulkKey="confirm.deleteSeries"
      >
        <MediaListShell.Chips />
        <MediaListShell.Body
          tableId="shows"
          columns={seriesColumns}
          Card={SeriesCard}
        />
        <MediaListShell.Drawer as={SeriesDrawer} />
      </MediaListShell>
    </Suspense>
  );
}
