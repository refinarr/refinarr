"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { AppShell } from "@/client/components/layout/AppShell";
import { AddInstanceDialog } from "@/client/components/settings/AddInstanceDialog";
import { InstanceCard } from "@/client/components/settings/InstanceCard";
import { DryRunToggle } from "@/client/components/settings/DryRunToggle";
import { ApiKeyCard } from "@/client/components/settings/ApiKeyCard";
import { PasswordChangeCard } from "@/client/components/settings/PasswordChangeCard";
import { ScoringModeSelector } from "@/client/components/settings/ScoringModeSelector";
import { CfPreferencePicker } from "@/client/components/settings/CfPreferencePicker";
import { SettingsCardSkeleton } from "@/client/components/states/SettingsCardSkeleton";
import { Button } from "@/client/components/ui/button";
import { Separator } from "@/client/components/ui/separator";
import { useInstances } from "@/client/hooks/data/useInstances";
import { useConfig } from "@/client/hooks/data/useConfig";
import type { Instance } from "@/shared/types/models";
import { Plus } from "lucide-react";

export default function SettingsPage() {
  const t = useTranslations("settings");
  const { data: instances, isLoading: loadingInstances } = useInstances();
  const { data: config } = useConfig();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Instance | null>(null);

  const manualInstances = (instances ?? []).filter(
    (i) => (config?.scoringModes[`scoringMode:${i.id}`] ?? "manual") === "manual"
  );

  return (
    <AppShell>
      <div className="max-w-2xl space-y-8">
        <h1 className="text-2xl font-bold">{t("title")}</h1>

        {/* Section 1: Instances */}
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

        <Separator />

        {/* Section 2: Scoring Mode per instance */}
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

        <Separator />

        {/* Section 3: Wanted Custom Formats (manual mode only) */}
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

        {/* Section 4: Dry Run */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">{t("dryRunMode")}</h2>
          <DryRunToggle />
        </section>

        <Separator />

        {/* Section 5: API Access */}
        <section>
          <ApiKeyCard />
        </section>

        <Separator />

        {/* Section 6: Account password */}
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
