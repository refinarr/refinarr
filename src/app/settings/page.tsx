"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AppShell } from "@/client/components/layout/AppShell";
import { AddInstanceDialog } from "@/client/components/settings/AddInstanceDialog";
import { InstanceCard } from "@/client/components/settings/InstanceCard";
import { DryRunToggle } from "@/client/components/settings/DryRunToggle";
import { ApiKeyCard } from "@/client/components/settings/ApiKeyCard";
import { PasswordChangeCard } from "@/client/components/settings/PasswordChangeCard";
import { ScoringModeSelector } from "@/client/components/settings/ScoringModeSelector";
import { AppearanceSelector } from "@/client/components/settings/AppearanceSelector";
import { isManualMode } from "@/shared/scoring-mode";
import { CfPreferencePicker } from "@/client/components/settings/CfPreferencePicker";
import { SettingsCardSkeleton } from "@/client/components/states/SettingsCardSkeleton";
import { Button } from "@/client/components/ui/button";
import { Separator } from "@/client/components/ui/separator";
import { useInstances } from "@/client/hooks/data/useInstances";
import type { Instance } from "@/shared/types/models";
import { Plus } from "lucide-react";

const KNOWN_ANCHORS = new Set(["dry-run", "appearance"]);

export default function SettingsPage() {
  const t = useTranslations("settings");
  const { data: instances, isLoading: loadingInstances } = useInstances();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Instance | null>(null);

  // App Router doesn't reliably auto-scroll to a hash anchor when the target
  // element renders post-mount (each settings section depends on async hooks).
  // Read the hash on mount and scroll to it after a short paint delay.
  useEffect(() => {
    const id = window.location.hash.replace(/^#/, "");
    if (!KNOWN_ANCHORS.has(id)) return;
    const t = setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
    return () => clearTimeout(t);
  }, []);

  const manualInstances = (instances ?? []).filter((i) => isManualMode(i.scoringMode));

  return (
    <AppShell>
      <div className="max-w-2xl space-y-8">
        <h1 className="text-2xl font-bold">{t("title")}</h1>

        {/* Dry Run — first so live-mode warning catches the eye */}
        <section id="dry-run" className="space-y-4 scroll-mt-20">
          <h2 className="text-lg font-semibold">{t("dryRunMode")}</h2>
          <DryRunToggle prominent />
        </section>

        <Separator />

        {/* Appearance */}
        <section id="appearance" className="space-y-4 scroll-mt-20">
          <h2 className="text-lg font-semibold">{t("appearance.title")}</h2>
          <AppearanceSelector />
        </section>

        <Separator />

        {/* Instances */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t("instances")}</h2>
            <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> {t("addInstance")}
            </Button>
          </div>
          {loadingInstances ? (
            <SettingsCardSkeleton />
          ) : (
            <div className="space-y-2">
              {(instances ?? []).map((inst) => (
                <InstanceCard
                  key={inst.id}
                  instance={inst}
                  onEdit={() => { setEditing(inst); setDialogOpen(true); }}
                />
              ))}
            </div>
          )}
        </section>

        {(instances ?? []).length > 0 && <Separator />}

        {/* Scoring Mode per instance */}
        {(instances ?? []).length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">{t("scoringMode")}</h2>
            <div className="space-y-3">
              {(instances ?? []).map((inst) => (
                <div key={inst.id} className="flex items-center gap-4">
                  <span className="text-sm font-medium w-36 truncate">{inst.name}</span>
                  <ScoringModeSelector instanceId={inst.id} />
                </div>
              ))}
            </div>
          </section>
        )}

        {manualInstances.length > 0 && <Separator />}

        {/* Wanted Custom Formats (manual mode only) */}
        {manualInstances.length > 0 && (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">{t("wantedCfs")}</h2>
              <p className="text-sm text-muted-foreground mt-1">{t("wantedCfsHelp")}</p>
            </div>
            <div className="space-y-3">
              {manualInstances.map((inst) => (
                <CfPreferencePicker key={inst.id} instance={inst} />
              ))}
            </div>
          </section>
        )}

        <Separator />

        {/* API Access */}
        <section>
          <ApiKeyCard />
        </section>

        <Separator />

        {/* Account password */}
        <section>
          <PasswordChangeCard />
        </section>
      </div>

      <AddInstanceDialog
        key={editing?.id ?? "new"}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editing={editing}
      />
    </AppShell>
  );
}
