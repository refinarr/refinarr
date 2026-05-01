"use client";
import { useState } from "react";
import { AppShell } from "@/client/components/layout/AppShell";
import { PageErrorBoundary } from "@/client/components/states/PageErrorBoundary";
import { NoInstancesPrompt } from "@/client/components/states/NoInstancesPrompt";
import { Button } from "@/client/components/ui/button";
import { Badge } from "@/client/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/client/components/ui/select";
import { useInstances } from "@/client/hooks/useInstances";
import { useIgnored, useUnignore } from "@/client/hooks/useIgnored";
import { withToast } from "@/client/lib/with-toast";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, Film, Tv2 } from "lucide-react";

export default function IgnoredPage() {
  const router = useRouter();
  const { data: instances, isLoading: loadingInstances } = useInstances();
  const [instanceId, setInstanceId] = useState<number>(0);
  const activeInstance = instanceId || instances?.[0]?.id || 0;

  const { data: entries, isLoading } = useIgnored(activeInstance);
  const unignore = useUnignore(activeInstance);
  const runUnignore = withToast(unignore, { success: "Unignored", error: "Failed to unignore" });

  if (!loadingInstances && !instances?.length) {
    return (
      <AppShell>
        <NoInstancesPrompt onAdd={() => router.push("/settings")} />
      </AppShell>
    );
  }

  const list = entries ?? [];

  return (
    <AppShell>
      <PageErrorBoundary>
        <div className="space-y-4 max-w-4xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Ignored</h1>
              <p className="text-muted-foreground text-sm mt-1">
                {list.length} item{list.length === 1 ? "" : "s"} hidden from triage
              </p>
            </div>
            {(instances?.length ?? 0) > 1 && (
              <Select value={String(activeInstance)} onValueChange={(v) => setInstanceId(Number(v ?? 0))}>
                <SelectTrigger className="w-44">
                  <SelectValue>
                    {instances?.find((i) => i.id === activeInstance)?.name ?? "Select instance"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(instances ?? []).map((i) => (
                    <SelectItem key={i.id} value={String(i.id)}>{i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && list.length === 0 && (
            <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
              Nothing ignored. Items you ignore from Movies or Shows will appear here.
            </div>
          )}

          {!isLoading && list.length > 0 && (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-background border-b">
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="w-20 px-3 py-2.5 font-medium">Type</th>
                    <th className="px-3 py-2.5 font-medium">Title</th>
                    <th className="w-40 px-3 py-2.5 font-medium">Ignored</th>
                    <th className="w-32 px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {list.map((entry) => (
                    <tr key={entry.id} className="border-t hover:bg-muted/40">
                      <td className="px-3 py-2 align-middle">
                        <Badge variant="outline" className="gap-1 capitalize">
                          {entry.mediaType === "movie" ? <Film className="h-3 w-3" /> : <Tv2 className="h-3 w-3" />}
                          {entry.mediaType}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 align-middle font-medium">{entry.title}</td>
                      <td className="px-3 py-2 align-middle text-muted-foreground text-xs">
                        {new Date(entry.ignoredAt).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2 align-middle text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => runUnignore(entry.id)}
                          disabled={unignore.isPending}
                        >
                          <RotateCcw className="h-3.5 w-3.5 mr-1" />
                          Unignore
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </PageErrorBoundary>
    </AppShell>
  );
}
