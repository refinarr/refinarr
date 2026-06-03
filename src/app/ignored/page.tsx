"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, Film, Tv2 } from "lucide-react";
import { AppShell } from "@/client/components/layout/AppShell";
import { PageErrorBoundary } from "@/client/components/states/PageErrorBoundary";
import { NoInstancesPrompt } from "@/client/components/states/NoInstancesPrompt";
import { Button } from "@/client/components/ui/button";
import { Badge } from "@/client/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import { useInstances } from "@/client/hooks/data/useInstances";
import { useIgnored, useUnignore } from "@/client/hooks/data/useIgnored";
import { withToast } from "@/client/lib/with-toast";
import { formatRelative } from "@/client/lib/format";

export default function IgnoredPage() {
  const t = useTranslations("ignored");
  const tToast = useTranslations("toast.ignore");
  const router = useRouter();
  const { data: instances, isLoading: loadingInstances } = useInstances();
  const [instanceId, setInstanceId] = useState<number>(0);
  const activeInstance = instanceId || instances?.[0]?.id || 0;

  const { data: entries, isLoading } = useIgnored(activeInstance);
  const unignore = useUnignore(activeInstance);
  const runUnignore = withToast(unignore, {
    success: tToast("removed"),
    error: tToast("removeFailed"),
  });

  if (!loadingInstances && !instances?.length) {
    return (
      <AppShell>
        <NoInstancesPrompt onAdd={() => router.push("/settings/instances")} />
      </AppShell>
    );
  }

  const list = entries ?? [];

  return (
    <AppShell>
      <PageErrorBoundary>
        <div className="max-w-4xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{t("title")}</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                {t("summary", { count: list.length })}
              </p>
            </div>
            {(instances?.length ?? 0) > 1 && (
              <Select
                value={String(activeInstance)}
                onValueChange={(v) => setInstanceId(Number(v ?? 0))}
              >
                <SelectTrigger
                  className="w-44"
                  aria-label={t("selectInstance")}
                >
                  <SelectValue>
                    {instances?.find((i) => i.id === activeInstance)?.name ??
                      t("selectInstance")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(instances ?? []).map((i) => (
                    <SelectItem key={i.id} value={String(i.id)}>
                      {i.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="text-muted-foreground size-5 animate-spin" />
            </div>
          )}

          {!isLoading && list.length === 0 && (
            <div className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
              {t("empty")}
            </div>
          )}

          {!isLoading && list.length > 0 && (
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-background border-b">
                  <tr className="text-muted-foreground text-left text-xs tracking-wide uppercase">
                    <th className="w-20 px-3 py-2.5 font-medium">
                      {t("columns.type")}
                    </th>
                    <th className="px-3 py-2.5 font-medium">
                      {t("columns.title")}
                    </th>
                    <th className="w-40 px-3 py-2.5 font-medium">
                      {t("columns.ignored")}
                    </th>
                    <th className="w-32 px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {list.map((entry) => (
                    <tr key={entry.id} className="hover:bg-muted/40 border-t">
                      <td className="px-3 py-2 align-middle">
                        <Badge variant="outline" className="gap-1 capitalize">
                          {entry.mediaType === "movie" ? (
                            <Film className="size-3" />
                          ) : (
                            <Tv2 className="size-3" />
                          )}
                          {entry.mediaType}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 align-middle font-medium">
                        {entry.title}
                      </td>
                      <td
                        className="text-muted-foreground px-3 py-2 align-middle text-xs"
                        title={new Date(entry.ignoredAt).toLocaleString()}
                      >
                        {formatRelative(entry.ignoredAt)}
                      </td>
                      <td className="px-3 py-2 text-right align-middle">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => runUnignore(entry.id)}
                          disabled={unignore.isPending}
                        >
                          <RotateCcw className="mr-1 size-3.5" />
                          {t("unignore")}
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
