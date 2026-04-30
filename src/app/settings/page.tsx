"use client";
import { useState } from "react";
import { AppShell } from "@/client/components/layout/AppShell";
import { AddInstanceDialog } from "@/client/components/settings/AddInstanceDialog";
import { InstanceCard } from "@/client/components/settings/InstanceCard";
import { DryRunToggle } from "@/client/components/settings/DryRunToggle";
import { ApiKeyCard } from "@/client/components/settings/ApiKeyCard";
import { ScoringModeSelector } from "@/client/components/settings/ScoringModeSelector";
import { Button } from "@/client/components/ui/button";
import { Separator } from "@/client/components/ui/separator";
import { useInstances } from "@/client/hooks/useInstances";
import type { Instance } from "@/shared/types/models";
import { Plus } from "lucide-react";

export default function SettingsPage() {
  const { data: instances } = useInstances();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Instance | null>(null);

  return (
    <AppShell>
      <div className="max-w-2xl space-y-8">
        <h1 className="text-2xl font-bold">Settings</h1>

        {/* Section 1: Instances */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Instances</h2>
            <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Add Instance
            </Button>
          </div>
          <div className="space-y-2">
            {(instances ?? []).map((inst) => (
              <InstanceCard
                key={inst.id}
                instance={inst}
                onEdit={() => { setEditing(inst); setDialogOpen(true); }}
              />
            ))}
          </div>
        </section>

        <Separator />

        {/* Section 2: Scoring Mode per instance */}
        {(instances ?? []).length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Scoring Mode</h2>
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

        {/* Section 3: Dry Run */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Dry Run Mode</h2>
          <DryRunToggle />
        </section>

        <Separator />

        {/* Section 4: API Access */}
        <section>
          <ApiKeyCard />
        </section>
      </div>

      <AddInstanceDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editing={editing}
      />
    </AppShell>
  );
}
