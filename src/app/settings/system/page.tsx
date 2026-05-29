"use client";
import { useTranslations } from "next-intl";
import { ExternalLink, RefreshCw } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { useSystem, useRefreshSystem } from "@/client/hooks/data/useSystem";
import { useMe } from "@/client/hooks/data/useMe";
import { withToast } from "@/client/lib/with-toast";
import { formatRelative } from "@/client/lib/format";
import type { SystemInfo } from "@/shared/types/api";

type UpdateState = "current" | "available" | "unavailable";

function toTuple(v: string): [number, number, number] {
  const [a = 0, b = 0, c = 0] = v
    .replace(/^v/, "")
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
  return [a, b, c];
}

// Tuple SemVer compare so a dev build with a version newer than the
// latest GitHub tag still reads as "current" instead of falsely
// claiming an upgrade is available.
function compareTag(
  release: SystemInfo["latestRelease"],
  version: string,
): UpdateState {
  if (!release) return "unavailable";
  const [a1, a2, a3] = toTuple(version);
  const [b1, b2, b3] = toTuple(release.tag);
  if (b1 > a1 || (b1 === a1 && (b2 > a2 || (b2 === a2 && b3 > a3)))) {
    return "available";
  }
  return "current";
}

interface RowProps {
  label: string;
  children: React.ReactNode;
}

function Row({ label, children }: RowProps) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b py-2 last:border-0">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-right text-sm">{children}</span>
    </div>
  );
}

export default function SystemSettingsPage() {
  const t = useTranslations("system");
  const tFields = useTranslations("system.fields");
  const tUpdate = useTranslations("system.update");
  const tAuth = useTranslations("system.auth");
  const tToast = useTranslations("toast.system");
  const { data: system, isLoading } = useSystem();
  const meQuery = useMe();
  const me = meQuery.data;
  const refresh = useRefreshSystem();

  const runRefresh = withToast(refresh, {
    success: tToast("refreshed"),
    error: tToast("refreshFailed"),
  });

  const updateState = system
    ? compareTag(system.latestRelease, system.version)
    : "unavailable";
  const release = system?.latestRelease ?? null;

  // `meQuery.isPending` = first fetch still running (no resolution yet).
  // After it settles, data is either populated (session/proxy auth) or
  // stays undefined because /auth/me returned 401 — which means the
  // user authenticated via X-Api-Key. Conflating "loading" with
  // "API key" caused a transient wrong-label flash on session pages.
  let authLabel: string;
  if (meQuery.isPending) authLabel = "—";
  else if (!me) authLabel = tAuth("apiKey");
  else if (me.source === "proxy")
    authLabel = tAuth("proxy", { username: me.username });
  else authLabel = tAuth("session", { username: me.username });

  return (
    <section className="space-y-section">
      <h2 className="text-lg font-semibold">{t("title")}</h2>
      <p className="text-muted-foreground text-sm">{t("subtitle")}</p>

      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-section">
          <div>
            <Row label={tFields("version")}>
              <span className="font-mono">{system?.version ?? "—"}</span>
              {system && updateState === "current" && (
                <Badge variant="outline" className="ml-2 text-[10px]">
                  {tUpdate("current")}
                </Badge>
              )}
              {system && updateState === "available" && release && (
                <a
                  href={release.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 inline-flex"
                >
                  <Badge
                    variant="outline"
                    className="border-info/40 text-info bg-info-soft text-[10px]"
                  >
                    {tUpdate("available", { tag: release.tag })}
                    <ExternalLink className="ml-1 size-3" />
                  </Badge>
                </a>
              )}
              {system && updateState === "unavailable" && (
                <Badge
                  variant="outline"
                  className="text-muted-foreground ml-2 text-[10px]"
                >
                  {tUpdate("unavailable")}
                </Badge>
              )}
            </Row>
            <Row label={tFields("uptime")}>
              {system ? formatRelative(system.bootedAtMs) : "—"}
            </Row>
            <Row label={tFields("auth")}>{authLabel}</Row>
            <Row label={tFields("runtime")}>
              <span className="font-mono">
                {system ? `${system.node} · ${system.platform}` : "—"}
              </span>
            </Row>
          </div>

          <div className="flex items-center justify-between border-t pt-4">
            <span className="text-muted-foreground text-xs">
              {tFields("lastChecked")}:{" "}
              {release ? formatRelative(release.checkedAtMs) : tUpdate("never")}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void runRefresh()}
              disabled={refresh.isPending || isLoading}
            >
              <RefreshCw className="mr-1.5 size-3.5" />
              {refresh.isPending ? tUpdate("checking") : t("actions.refresh")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
