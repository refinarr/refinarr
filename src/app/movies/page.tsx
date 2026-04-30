"use client";
import { useState } from "react";
import { AppShell } from "@/client/components/layout/AppShell";
import { FilterBar } from "@/client/components/media/FilterBar";
import { BulkActionToolbar } from "@/client/components/media/BulkActionToolbar";
import { MediaTableSkeleton } from "@/client/components/media/MediaTableSkeleton";
import { CfBadge } from "@/client/components/media/CfBadge";
import { AllClearState } from "@/client/components/states/AllClearState";
import { NoCfsPrompt } from "@/client/components/states/NoCfsPrompt";
import { NoInstancesPrompt } from "@/client/components/states/NoInstancesPrompt";
import { MediaErrorCard } from "@/client/components/states/MediaErrorCard";
import { PageErrorBoundary } from "@/client/components/states/PageErrorBoundary";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/client/components/ui/table";
import { Checkbox } from "@/client/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/client/components/ui/select";
import { useInstances } from "@/client/hooks/useInstances";
import { useMovies } from "@/client/hooks/useMovies";
import { useInfiniteScroll } from "@/client/hooks/useInfiniteScroll";
import { api } from "@/client/lib/api";
import { toast } from "sonner";
import type { FlaggedMovie } from "@/shared/types/models";
import { useRouter } from "next/navigation";

export default function MoviesPage() {
  const router = useRouter();
  const { data: instances, isLoading: loadingInstances } = useInstances();
  const [instanceId, setInstanceId] = useState<number>(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [filters, setFilters] = useState<{ sortBy: "score" | "title" | "added"; order: "asc" | "desc"; maxScore: number }>({ sortBy: "score", order: "asc", maxScore: 1 });

  const activeInstance = instanceId || instances?.[0]?.id || 0;
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, refetch } =
    useMovies(activeInstance, filters);

  const sentinelRef = useInfiniteScroll(fetchNextPage, !!hasNextPage);

  const allMovies: FlaggedMovie[] = data?.pages.flatMap((p) => p.items) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectedMovies = allMovies.filter((m) => selected.has(m.id));

  const handleSearch = async () => {
    for (const m of selectedMovies) {
      await api.post(`/radarr/movies/search`, { instanceId: activeInstance, mediaId: m.id, title: m.title });
    }
    toast.success("Search triggered");
    setSelected(new Set());
  };

  const handleIgnore = async () => {
    for (const m of selectedMovies) {
      await api.post(`/ignore`, { instanceId: activeInstance, mediaId: m.id, mediaType: "movie", title: m.title });
    }
    toast.success("Items ignored");
    setSelected(new Set());
    refetch();
  };

  if (!loadingInstances && !instances?.length) {
    return (
      <AppShell>
        <NoInstancesPrompt onAdd={() => router.push("/settings")} />
      </AppShell>
    );
  }

  const radarrInstances = instances?.filter((i) => i.type === "radarr") ?? [];

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
                  <SelectValue>{radarrInstances.find((i) => i.id === activeInstance)?.name ?? "Select instance"}</SelectValue>
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
            activeInstance ? <AllClearState /> : <NoCfsPrompt />
          )}

          {!isLoading && allMovies.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Title</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Missing CFs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allMovies.map((movie) => (
                  <TableRow key={movie.id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(movie.id)}
                        onCheckedChange={() => toggle(movie.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{movie.title}</TableCell>
                    <TableCell className="text-muted-foreground">{movie.year}</TableCell>
                    <TableCell>{Math.round(movie.cfScore * 100)}%</TableCell>
                    <TableCell className="flex flex-wrap gap-1">
                      {movie.missingFormats.map((cf) => (
                        <CfBadge key={cf.id} name={cf.name} missing />
                      ))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div ref={sentinelRef} className="h-4" />
          {isFetchingNextPage && <MediaTableSkeleton rows={3} />}
        </div>
      </PageErrorBoundary>
    </AppShell>
  );
}
