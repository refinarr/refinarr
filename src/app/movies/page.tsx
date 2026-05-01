"use client";
import { AppShell } from "@/client/components/layout/AppShell";
import { FilterBar } from "@/client/components/media/FilterBar";
import { BulkActionToolbar } from "@/client/components/media/BulkActionToolbar";
import { MediaTableSkeleton } from "@/client/components/media/MediaTableSkeleton";
import { AllClearState } from "@/client/components/states/AllClearState";
import { NoCfsPrompt } from "@/client/components/states/NoCfsPrompt";
import { NoInstancesPrompt } from "@/client/components/states/NoInstancesPrompt";
import { MediaErrorCard } from "@/client/components/states/MediaErrorCard";
import { PageErrorBoundary } from "@/client/components/states/PageErrorBoundary";
import { Accordion } from "@/client/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/client/components/ui/select";
import { MovieAccordionItem } from "@/client/components/movies/MovieAccordionItem";
import { useMoviesPage } from "@/client/hooks/useMoviesPage";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function MoviesPage() {
  const {
    router,
    instances,
    loadingInstances,
    radarrInstances,
    activeInstance,
    setInstanceId,
    selected,
    toggle,
    filters,
    setFilters,
    allMovies,
    total,
    isLoading,
    isError,
    isFetchingNextPage,
    refetch,
    sentinelRef,
    scoringMode,
    noCfsConfigured,
    handleSearch,
    handleIgnore,
  } = useMoviesPage();

  if (!loadingInstances && !instances?.length) {
    return (
      <AppShell>
        <NoInstancesPrompt onAdd={() => router.push("/settings")} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageErrorBoundary>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Movies</h1>
              {!isLoading && <p className="text-muted-foreground text-sm mt-1">{total} flagged</p>}
            </div>
            {radarrInstances.length > 1 && (
              <Select value={String(activeInstance)} onValueChange={(v) => setInstanceId(Number(v ?? 0))}>
                <SelectTrigger className="w-44">
                  <SelectValue>
                    {radarrInstances.find((i) => i.id === activeInstance)?.name ?? "Select instance"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {radarrInstances.map((i) => (
                    <SelectItem key={i.id} value={String(i.id)}>{i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <FilterBar filters={filters} onChange={(f) => setFilters((prev) => ({ ...prev, ...f }))} />

          <BulkActionToolbar
            selectedCount={selected.size}
            onSearch={handleSearch}
            onDelete={() => toast.error("Delete: select items first")}
            onIgnore={handleIgnore}
          />

          {(isLoading || loadingInstances) && <MediaTableSkeleton />}
          {isError && <MediaErrorCard onRetry={refetch} />}
          {!loadingInstances && !isLoading && !isError && allMovies.length === 0 && (
            activeInstance
              ? noCfsConfigured ? <NoCfsPrompt /> : <AllClearState />
              : <NoCfsPrompt />
          )}

          {!isLoading && allMovies.length > 0 && (
            <Accordion>
              {allMovies.map((movie) => (
                <MovieAccordionItem
                  key={movie.id}
                  movie={movie}
                  selected={selected.has(movie.id)}
                  onToggle={() => toggle(movie.id)}
                  scoringMode={scoringMode}
                />
              ))}
            </Accordion>
          )}

          <div ref={sentinelRef} className="h-4" />
          {isFetchingNextPage && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      </PageErrorBoundary>
    </AppShell>
  );
}
